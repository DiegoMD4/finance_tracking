import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { bankAccounts, users } from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { eq } from "drizzle-orm"
import {
  checkDuplicateAccount,
  createBankAccount,
  deleteBankAccount,
  updateBankAccount,
} from "@/server/bank-accounts/actions"
import {
  getBankAccountById,
  getBankAccounts,
  getBankAccountsPaginated,
} from "@/server/bank-accounts/queries"

const session = vi.hoisted(() => ({ userId: null as number | null }))

vi.mock("@/lib/jwt", () => ({
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { revalidatePath } from "next/cache"

const mockRevalidatePath = vi.mocked(revalidatePath)

const validAccountFields = {
  bankName: "Banco Atlántida",
  accountName: "Ahorros personales",
  accountNumber: "1234567890123456",
  bankAccountType: "savings",
  currency: "HNL",
  email: "ahorros@test.com",
  openingBalance: "1500.50",
}

function buildAccountFormData(
  overrides: Record<string, string> = {}
): FormData {
  const formData = new FormData()
  const values = { ...validAccountFields, ...overrides }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

async function createTestUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({
      name: "Test User",
      email,
      password: "hashed",
    })
    .$returningId()

  return user.id
}

async function insertTestAccount(
  userId: number,
  overrides: Partial<typeof bankAccounts.$inferInsert> = {}
): Promise<number> {
  const [account] = await db
    .insert(bankAccounts)
    .values({
      accountNumber: "1111222233334444",
      bankName: "Banco Test",
      accountName: "Cuenta Test",
      bankAccountType: "savings",
      accountCurrency: "HNL",
      accountEmail: "cuenta@test.com",
      openingBalance: "100.00",
      userId,
      ...overrides,
    })
    .$returningId()

  return account.id
}

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  session.userId = null
})

describe("createBankAccount", () => {
  it("BA-01: crea una cuenta con datos válidos", async () => {
    // Dado: un usuario autenticado y datos válidos
    const userId = await createTestUser("ba01@test.com")
    session.userId = userId

    // Cuando: se crea la cuenta
    const result = await createBankAccount(null, buildAccountFormData())

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("New bank account added successfully")

    // Y: la cuenta quedó persistida con los datos normalizados
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))

    expect(account).toBeDefined()
    expect(account.userId).toBe(userId)
    expect(account.bankName).toBe(validAccountFields.bankName)
    expect(account.accountName).toBe(validAccountFields.accountName)
    expect(account.accountNumber).toBe(validAccountFields.accountNumber)
    expect(account.bankAccountType).toBe(validAccountFields.bankAccountType)
    expect(account.accountCurrency).toBe(validAccountFields.currency)
    expect(account.accountEmail).toBe(validAccountFields.email)
    expect(account.openingBalance).toBe("1500.50")

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/bank-accounts")
  })

  it("BA-02: número de cuenta duplicado retorna error", async () => {
    // Dado: ya existe una cuenta del usuario con ese número
    const userId = await createTestUser("ba02@test.com")
    session.userId = userId
    await insertTestAccount(userId, {
      accountNumber: "9999888877776666",
      accountName: "Cuenta existente",
    })

    // Cuando: se intenta crear otra cuenta con el mismo número
    const result = await createBankAccount(
      null,
      buildAccountFormData({
        accountNumber: "9999888877776666",
        accountName: "Cuenta nueva",
      })
    )

    // Entonces: el error apunta solo al número de cuenta
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Validation error")
    expect(result?.error?.accountNumber).toBe(
      "This account number is already registered"
    )
    expect(result?.error?.accountName).toBeUndefined()

    // Y: no se insertó una segunda cuenta
    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(1)
  })

  it("BA-03: nombre de cuenta duplicado retorna error", async () => {
    // Dado: ya existe una cuenta del usuario con ese nombre
    const userId = await createTestUser("ba03@test.com")
    session.userId = userId
    await insertTestAccount(userId, {
      accountNumber: "8888777766665555",
      accountName: "Cuenta duplicada",
    })

    // Cuando: se intenta crear otra cuenta con el mismo nombre
    const result = await createBankAccount(
      null,
      buildAccountFormData({
        accountNumber: "7777666655554444",
        accountName: "Cuenta duplicada",
      })
    )

    // Entonces: el error apunta solo al nombre de la cuenta
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Validation error")
    expect(result?.error?.accountName).toBe(
      "You already have an account registered with this account name"
    )
    expect(result?.error?.accountNumber).toBeUndefined()

    // Y: no se insertó una segunda cuenta
    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(1)
  })

  it("BA-04: sin sesión retorna Unauthorized y no inserta", async () => {
    // Dado: no hay sesión activa (session.userId = null)

    // Cuando: se intenta crear una cuenta
    const result = await createBankAccount(null, buildAccountFormData())

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: no se insertó nada
    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(0)
  })

  it("BA-05: accountNumber con letras retorna error de validación", async () => {
    // Dado: un usuario autenticado y un número de cuenta inválido
    const userId = await createTestUser("ba05@test.com")
    session.userId = userId

    // Cuando: se intenta crear la cuenta
    const result = await createBankAccount(
      null,
      buildAccountFormData({ accountNumber: "ABC123" })
    )

    // Entonces: Zod rechaza el campo y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.accountNumber).toBe(
      "Account number must contain only numbers"
    )

    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(0)
  })

  it("BA-06: error de base de datos retorna success false", async () => {
    // Dado: una sesión con un userId que ya no existe en users.
    // El INSERT viola la FK bank_accounts.user_id -> users.user_id.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    session.userId = 999_999

    // Cuando: se intenta crear la cuenta
    const result = await createBankAccount(
      null,
      buildAccountFormData({ accountNumber: "5555666677778888" })
    )

    // Entonces: la acción captura el error de Drizzle y no persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toMatch(/failed query/i)

    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(0)

    consoleError.mockRestore()
  })
})

describe("updateBankAccount", () => {
  it("BA-07: actualiza una cuenta propia con datos válidos", async () => {
    // Dado: un usuario autenticado con una cuenta existente
    const userId = await createTestUser("ba07@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)

    // Cuando: se actualiza con datos nuevos
    const result = await updateBankAccount(
      null,
      buildAccountFormData({
        id: String(accountId),
        bankName: "Banco Actualizado",
        accountName: "Cuenta Actualizada",
        accountNumber: "2222333344445555",
        bankAccountType: "checking",
        currency: "USD",
        email: "updated@test.com",
        openingBalance: "2500.75",
      })
    )

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Bank account updated successfully")

    // Y: todos los campos quedaron actualizados en la base de datos
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, accountId))

    expect(account.bankName).toBe("Banco Actualizado")
    expect(account.accountName).toBe("Cuenta Actualizada")
    expect(account.accountNumber).toBe("2222333344445555")
    expect(account.bankAccountType).toBe("checking")
    expect(account.accountCurrency).toBe("USD")
    expect(account.accountEmail).toBe("updated@test.com")
    expect(account.openingBalance).toBe("2500.75")

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/bank-accounts")
  })

  it("BA-08: sin id retorna error", async () => {
    // Dado: un usuario autenticado y un formulario sin id
    const userId = await createTestUser("ba08@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateBankAccount(null, buildAccountFormData())

    // Entonces: retorna error de id faltante
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Missing or invalid Bank Account ID")
  })

  it("BA-08: id no numérico retorna error", async () => {
    // Dado: un usuario autenticado y un id no numérico
    const userId = await createTestUser("ba08b@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateBankAccount(
      null,
      buildAccountFormData({ id: "abc" })
    )

    // Entonces: retorna error de id inválido
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Missing or invalid Bank Account ID")
  })

  it("BA-09: sin sesión retorna Unauthorized y no actualiza", async () => {
    // Dado: existe una cuenta, pero no hay sesión activa
    const userId = await createTestUser("ba09@test.com")
    const accountId = await insertTestAccount(userId)
    session.userId = null

    // Cuando: se intenta actualizar
    const result = await updateBankAccount(
      null,
      buildAccountFormData({
        id: String(accountId),
        bankName: "Intento no autorizado",
      })
    )

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: la cuenta no fue modificada
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, accountId))
    expect(account.bankName).toBe("Banco Test")
  })

  it("BA-10: id inexistente retorna error y no revalida", async () => {
    // Dado: un usuario autenticado y un id que no existe
    const userId = await createTestUser("ba10@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateBankAccount(
      null,
      buildAccountFormData({ id: "999999", bankName: "Fantasma" })
    )

    // Entonces: la acción detecta que no se actualizó ninguna fila
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Bank account not found")

    // Y: no se creó ni modificó ninguna cuenta
    const rows = await db.select().from(bankAccounts)
    expect(rows).toHaveLength(0)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe("deleteBankAccount", () => {
  it("BA-11: elimina una cuenta propia", async () => {
    // Dado: un usuario autenticado con una cuenta existente
    const userId = await createTestUser("ba11@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)

    // Cuando: se elimina la cuenta
    const result = await deleteBankAccount(accountId)

    // Entonces: retorna éxito
    expect(result.success).toBe(true)
    expect(result.message).toBe("Bank account deleted")

    // Y: la fila ya no existe
    const rows = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, accountId))
    expect(rows).toHaveLength(0)

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/bank-accounts")
  })

  it("BA-12: sin sesión retorna Unauthorized y no elimina", async () => {
    // Dado: existe una cuenta, pero no hay sesión activa
    const userId = await createTestUser("ba12@test.com")
    const accountId = await insertTestAccount(userId)
    session.userId = null

    // Cuando: se intenta eliminar
    const result = await deleteBankAccount(accountId)

    // Entonces: retorna Unauthorized
    expect(result.success).toBe(false)
    expect(result.message).toBe("Unauthorized: a valid session is required")

    // Y: la cuenta sigue existiendo
    const rows = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, accountId))
    expect(rows).toHaveLength(1)
  })
})

describe("checkDuplicateAccount (integration)", () => {
  it("BA-16: no marca duplicado cuando es la propia cuenta en un update", async () => {
    // Dado: una cuenta existente del usuario
    const userId = await createTestUser("ba16@test.com")
    const accountId = await insertTestAccount(userId, {
      accountNumber: "4444333322221111",
      accountName: "Cuenta propia",
    })

    // Cuando: se valida duplicado con su propio id (update de la misma cuenta)
    const result = await checkDuplicateAccount({
      accountNumber: "4444333322221111",
      accountName: "Cuenta propia",
      id: accountId,
      userId,
    })

    // Entonces: la propia fila queda excluida por el `ne(id)`
    expect(result.isDuplicate).toBe(false)
    expect(result.errors).toEqual({})
  })
})

describe("bank account queries", () => {
  it("BA-17: getBankAccounts devuelve las cuentas del usuario", async () => {
    // Dado: un usuario con dos cuentas
    const userId = await createTestUser("ba17@test.com")
    session.userId = userId
    await insertTestAccount(userId, {
      accountNumber: "1000000000000001",
      accountName: "Cuenta 1",
    })
    await insertTestAccount(userId, {
      accountNumber: "1000000000000002",
      accountName: "Cuenta 2",
    })

    // Cuando: se listan sus cuentas
    const result = await getBankAccounts()

    // Entonces: retorna ok con ambas cuentas del usuario
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(2)
    expect(result.data.every((account) => account.userId === userId)).toBe(true)
  })

  it("BA-18: getBankAccounts sin sesión retorna unauthorized", async () => {
    // Dado: no hay sesión activa
    session.userId = null

    // Cuando: se listan las cuentas
    const result = await getBankAccounts()

    // Entonces: retorna error unauthorized
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("unauthorized")
  })

  it("BA-19: getBankAccounts con DB caída retorna database", async () => {
    // Dado: un usuario autenticado y una falla de conexión simulada
    const userId = await createTestUser("ba19@test.com")
    session.userId = userId

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const selectSpy = vi.spyOn(db, "select").mockImplementationOnce(() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3306")
    })

    // Cuando: se listan las cuentas
    const result = await getBankAccounts()

    // Entonces: la query captura el error y lo mapea a "database"
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("database")

    selectSpy.mockRestore()
    consoleError.mockRestore()
  })

  it("BA-20: getBankAccountsPaginated devuelve pageSize items y hasMore false", async () => {
    // Dado: exactamente 5 cuentas (igual al pageSize)
    const userId = await createTestUser("ba20@test.com")
    session.userId = userId
    for (let i = 0; i < 5; i += 1) {
      await insertTestAccount(userId, {
        accountNumber: String(1_000_000_000_000_000 + i),
        accountName: `Cuenta ${i}`,
      })
    }

    // Cuando: se pide la primera página
    const result = await getBankAccountsPaginated(1, 5)

    // Entonces: devuelve 5 items y no hay más páginas
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.items).toHaveLength(5)
    expect(result.data.hasMore).toBe(false)
  })

  it("BA-21: getBankAccountsPaginated marca hasMore con más de pageSize", async () => {
    // Dado: 6 cuentas (una más que el pageSize)
    const userId = await createTestUser("ba21@test.com")
    session.userId = userId
    for (let i = 0; i < 6; i += 1) {
      await insertTestAccount(userId, {
        accountNumber: String(2_000_000_000_000_000 + i),
        accountName: `Cuenta ${i}`,
      })
    }

    // Cuando: se pide la primera página
    const result = await getBankAccountsPaginated(1, 5)

    // Entonces: devuelve 5 items y marca que hay más
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.items).toHaveLength(5)
    expect(result.data.hasMore).toBe(true)
  })

  it("BA-22: getBankAccountById devuelve la cuenta del usuario", async () => {
    // Dado: un usuario con una cuenta
    const userId = await createTestUser("ba22@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)

    // Cuando: se busca por id
    const result = await getBankAccountById({ id: accountId })

    // Entonces: retorna ok con la cuenta
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.id).toBe(accountId)
    expect(result.data.userId).toBe(userId)
  })

  it("BA-23: getBankAccountById con id inexistente retorna not_found", async () => {
    // Dado: un usuario autenticado sin esa cuenta
    const userId = await createTestUser("ba23@test.com")
    session.userId = userId

    // Cuando: se busca un id que no existe
    const result = await getBankAccountById({ id: 999_999 })

    // Entonces: retorna not_found
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("not_found")
  })

  it("BA-24: getBankAccountById no devuelve cuentas de otro usuario", async () => {
    // Dado: una cuenta que pertenece a otro usuario
    const ownerId = await createTestUser("ba24-owner@test.com")
    const otherId = await createTestUser("ba24-other@test.com")
    const accountId = await insertTestAccount(ownerId)
    session.userId = otherId

    // Cuando: el otro usuario intenta buscar esa cuenta
    const result = await getBankAccountById({ id: accountId })

    // Entonces: no la encuentra (el filtro por userId la excluye)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("not_found")
  })
})
