import { beforeEach, describe, expect, it, test, vi } from "vitest"
import { db } from "@/db"
import {
  bankAccounts,
  categories,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getExchangeRate } from "@/lib/currency"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import {
  createBulkTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/transactions/actions"
import {
  getTransactions,
  getTransactionsById,
  getTransactionsPaginated,
} from "@/server/transactions/queries"

const session = vi.hoisted(() => ({ userId: null as number | null }))

vi.mock("@/lib/jwt", () => ({
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/currency", () => ({
  getExchangeRate: vi.fn(),
}))

const mockRevalidatePath = vi.mocked(revalidatePath)
const mockGetExchangeRate = vi.mocked(getExchangeRate)

const validTransactionFields = {
  amount: "25.50",
  transactionType: "expense",
  transactionDescription: "Super",
  transactionDate: "2026-01-10",
  transactionCurrency: "HNL",
}

function buildTransactionFormData(
  overrides: Record<string, string> = {}
): FormData {
  const formData = new FormData()
  const values = { ...validTransactionFields, ...overrides }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function buildBulkFormData({
  accountId,
  rows,
  currency,
}: {
  accountId: string | number
  rows: unknown[]
  currency?: string
}): FormData {
  const formData = new FormData()
  formData.set("accountId", String(accountId))
  formData.set("transactionsJson", JSON.stringify(rows))

  if (currency) {
    formData.set("transactionCurrency", currency)
  }

  return formData
}

function buildBulkRow(
  index: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    tempId: `temp-${index}`,
    row: index,
    amount: "10.00",
    transactionType: "expense",
    transactionDescription: `Fila ${index}`,
    transactionDate: "2026-01-10",
    bankReference: null,
    ...overrides,
  }
}

async function createTestUser(
  email: string,
  defaultCurrency = "HNL"
): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({
      name: "Test User",
      email,
      password: "hashed",
      defaultCurrency,
    })
    .$returningId()

  return user.id
}

let accountSequence = 0

async function insertTestAccount(
  userId: number,
  overrides: Partial<typeof bankAccounts.$inferInsert> = {}
): Promise<number> {
  accountSequence += 1

  const [account] = await db
    .insert(bankAccounts)
    .values({
      accountNumber: `TXN-${accountSequence}`,
      bankName: "Banco Test",
      accountName: "Cuenta Test",
      userId,
      ...overrides,
    })
    .$returningId()

  return account.id
}

async function insertTestCategory(
  userId: number | null,
  overrides: Partial<typeof categories.$inferInsert> = {}
): Promise<number> {
  const [category] = await db
    .insert(categories)
    .values({
      name: "Categoría Test",
      icon: "tag",
      color: "#64748b",
      userId,
      ...overrides,
    })
    .$returningId()

  return category.categoryId
}

async function insertTestTransaction({
  userId,
  accountId,
  categoryId,
  amount = "100.00",
  transactionType = "expense",
  transactionDescription = "Transacción de prueba",
  transactionDate = new Date("2026-01-10T00:00:00"),
  transactionCurrency = "HNL",
  exchangeRate = "1.000000",
  amountInDefaultCurrency = amount,
  defaultCurrencyAtTransaction = "HNL",
}: {
  userId: number
  accountId: number
  categoryId: number
  amount?: string
  transactionType?: "income" | "expense"
  transactionDescription?: string | null
  transactionDate?: Date
  transactionCurrency?: string
  exchangeRate?: string
  amountInDefaultCurrency?: string
  defaultCurrencyAtTransaction?: string
}): Promise<number> {
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId,
      accountId,
      categoryId,
      amount,
      transactionType,
      transactionDescription,
      transactionDate,
      transactionCurrency,
      exchangeRate,
      amountInDefaultCurrency,
      defaultCurrencyAtTransaction,
    })
    .$returningId()

  return transaction.id
}

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  session.userId = null
  mockGetExchangeRate.mockResolvedValue(1)
})

describe("createTransaction", () => {
  test("Create a transaction with valid data and returns success", async () => {
    // Dado: un usuario autenticado con cuenta y categoría
    const userId = await createTestUser("user@user.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId, { name: "Food" })

    // Cuando: se crea la transacción
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(accountId),
        categoryId: String(categoryId),
      })
    )

    // Entonces: retorna éxito y la fila queda persistida
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Transaction created successfully")

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe("25.50")
    expect(rows[0].transactionType).toBe("expense")
  })

  test("invalid amount returns error and doesnt persist", async () => {
    // Dado: un usuario autenticado y un monto inválido
    const userId = await createTestUser("invalid-amount@test.com")
    session.userId = userId

    // Cuando: se intenta crear la transacción
    const result = await createTransaction(
      null,
      buildTransactionFormData({ amount: "abc" })
    )

    // Entonces: Zod rechaza el monto y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.error?.amount).toBeDefined()

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })

  test("ignora un userId spoofeado en el formData", async () => {
    // Dado: un usuario autenticado y un userId falso en el formulario
    const userId = await createTestUser("test@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId, { name: "Food" })

    // Cuando: se crea la transacción con userId spoofeado
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        userId: "999",
        accountId: String(accountId),
        categoryId: String(categoryId),
      })
    )

    // Entonces: la fila usa el userId de la sesión, no el del cliente
    expect(result?.success).toBe(true)
    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(userId)
  })

  it("T-01: sin sesión retorna Unauthorized y no inserta", async () => {
    // Dado: no hay sesión activa (session.userId = null)

    // Cuando: se intenta crear una transacción
    const result = await createTransaction(null, buildTransactionFormData())

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: no se insertó nada
    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })

  it("T-02: convierte la moneda distinta a la default", async () => {
    // Dado: usuario con default HNL y una tasa USD -> HNL de 24.5
    const userId = await createTestUser("t02@test.com", "HNL")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    mockGetExchangeRate.mockResolvedValueOnce(24.5)

    // Cuando: se crea una transacción en USD
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(accountId),
        categoryId: String(categoryId),
        amount: "10.00",
        transactionCurrency: "USD",
      })
    )

    // Entonces: se aplicó la tasa y se guardó el monto convertido
    expect(result?.success).toBe(true)
    expect(mockGetExchangeRate).toHaveBeenCalledWith("USD", "HNL")

    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(row.transactionCurrency).toBe("USD")
    expect(row.exchangeRate).toBe("24.500000")
    expect(row.amountInDefaultCurrency).toBe("245.00")
    expect(row.defaultCurrencyAtTransaction).toBe("HNL")
  })

  it("T-03: fallo de la tasa de cambio retorna error y no persiste", async () => {
    // Dado: la API de tasas falla
    const userId = await createTestUser("t03@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    mockGetExchangeRate.mockRejectedValueOnce(
      new Error("Exchange API error: 500")
    )

    // Cuando: se crea una transacción en USD
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(accountId),
        categoryId: String(categoryId),
        transactionCurrency: "USD",
      })
    )

    // Entonces: retorna el mensaje del error y no persiste
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Exchange API error: 500")

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })

  it("T-04: usa la categoría por defecto cuando categoryId viene vacío", async () => {
    // Dado: un usuario con su categoría por defecto
    const userId = await createTestUser("t04@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const defaultCategoryId = await insertTestCategory(userId, {
      name: DEFAULT_CATEGORY_NAME,
    })

    // Cuando: se crea la transacción sin categoría
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(accountId),
        categoryId: "",
      })
    )

    // Entonces: se asigna la categoría por defecto
    expect(result?.success).toBe(true)

    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(row.categoryId).toBe(defaultCategoryId)
  })

  it("T-05: rechaza una cuenta que pertenece a otro usuario", async () => {
    // Dado: una cuenta que pertenece a otro usuario
    const ownerId = await createTestUser("t05-owner@test.com")
    const otherId = await createTestUser("t05-other@test.com")
    const foreignAccountId = await insertTestAccount(ownerId)
    const categoryId = await insertTestCategory(otherId)
    session.userId = otherId

    // Cuando: el otro usuario intenta usarla
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(foreignAccountId),
        categoryId: String(categoryId),
      })
    )

    // Entonces: la cuenta no se encuentra en su sesión y no se inserta
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Bank account not found")

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })

  it("T-06: rechaza una fecha futura", async () => {
    // Dado: un usuario autenticado y una fecha futura
    const userId = await createTestUser("t06@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)

    // Cuando: se intenta crear la transacción
    const result = await createTransaction(
      null,
      buildTransactionFormData({
        accountId: String(accountId),
        categoryId: String(categoryId),
        transactionDate: "2999-01-01",
      })
    )

    // Entonces: Zod rechaza la fecha y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.transactionDate).toBe("Can't submit a future date")

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })

  it("T-07: campos inválidos retornan errores por campo", async () => {
    // Dado: un usuario autenticado, monto inválido y sin cuenta
    const userId = await createTestUser("t07@test.com")
    session.userId = userId

    // Cuando: se intenta crear la transacción
    const result = await createTransaction(
      null,
      buildTransactionFormData({ amount: "abc", accountId: "" })
    )

    // Entonces: cada campo inválido tiene su error y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.accountId).toBe("Bank account is required")
    expect(result?.error?.amount).toBe(
      "Amount must be a valid number with up to 2 decimals"
    )

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })
})

describe("updateTransaction", () => {
  it("T-08: actualiza una transacción propia con datos válidos", async () => {
    // Dado: un usuario autenticado con una transacción existente
    const userId = await createTestUser("t08@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
    })

    // Cuando: se actualiza con datos nuevos (incluida la fecha)
    const result = await updateTransaction(
      null,
      buildTransactionFormData({
        id: String(transactionId),
        accountId: String(accountId),
        categoryId: String(categoryId),
        amount: "99.99",
        transactionType: "income",
        transactionDescription: "Actualizada",
        transactionDate: "2026-03-15",
      })
    )

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Transaction updated successfully")

    // Y: todos los campos quedaron actualizados en la base de datos
    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))

    expect(row.amount).toBe("99.99")
    expect(row.transactionType).toBe("income")
    expect(row.transactionDescription).toBe("Actualizada")
    expect(row.transactionDate.toISOString().slice(0, 10)).toBe("2026-03-15")
    expect(row.categoryId).toBe(categoryId)

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions")
  })

  it("T-09: sin id retorna error", async () => {
    // Dado: un usuario autenticado y un formulario sin id
    const userId = await createTestUser("t09@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateTransaction(null, buildTransactionFormData())

    // Entonces: retorna error de id faltante
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Missing or invalid transaction ID")
  })

  it("T-10: sin sesión retorna Unauthorized y no actualiza", async () => {
    // Dado: existe una transacción, pero no hay sesión activa
    const userId = await createTestUser("t10@test.com")
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
    })
    session.userId = null

    // Cuando: se intenta actualizar
    const result = await updateTransaction(
      null,
      buildTransactionFormData({
        id: String(transactionId),
        accountId: String(accountId),
        categoryId: String(categoryId),
        amount: "999.00",
      })
    )

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: la transacción no fue modificada
    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(row.amount).toBe("100.00")
  })

  it("T-11: recalcula la conversión al cambiar la moneda", async () => {
    // Dado: una transacción en HNL y una tasa USD -> HNL de 24.5
    const userId = await createTestUser("t11@test.com", "HNL")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "10.00",
      transactionCurrency: "HNL",
      exchangeRate: "1.000000",
      amountInDefaultCurrency: "10.00",
    })
    mockGetExchangeRate.mockResolvedValueOnce(24.5)

    // Cuando: se cambia la moneda a USD
    const result = await updateTransaction(
      null,
      buildTransactionFormData({
        id: String(transactionId),
        accountId: String(accountId),
        categoryId: String(categoryId),
        amount: "10.00",
        transactionCurrency: "USD",
      })
    )

    // Entonces: se recalcularon la tasa y el monto en moneda default
    expect(result?.success).toBe(true)
    expect(mockGetExchangeRate).toHaveBeenCalledWith("USD", "HNL")

    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(row.transactionCurrency).toBe("USD")
    expect(row.exchangeRate).toBe("24.500000")
    expect(row.amountInDefaultCurrency).toBe("245.00")
  })
})

describe("deleteTransaction", () => {
  it("T-12: elimina una transacción propia", async () => {
    // Dado: un usuario autenticado con una transacción existente
    const userId = await createTestUser("t12@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
    })

    // Cuando: se elimina la transacción
    const result = await deleteTransaction(transactionId)

    // Entonces: retorna éxito
    expect(result.success).toBe(true)
    expect(result.message).toBe("Transaction deleted")

    // Y: la fila ya no existe
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(rows).toHaveLength(0)

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions")
  })

  it("T-13: sin sesión retorna Unauthorized y no elimina", async () => {
    // Dado: existe una transacción, pero no hay sesión activa
    const userId = await createTestUser("t13@test.com")
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
    })
    session.userId = null

    // Cuando: se intenta eliminar
    const result = await deleteTransaction(transactionId)

    // Entonces: retorna Unauthorized
    expect(result.success).toBe(false)
    expect(result.message).toBe("Unauthorized: a valid session is required")

    // Y: la transacción sigue existiendo
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(rows).toHaveLength(1)
  })

  it("T-14: no elimina la transacción de otro usuario", async () => {
    // Dado: una transacción que pertenece a otro usuario
    const ownerId = await createTestUser("t14-owner@test.com")
    const otherId = await createTestUser("t14-other@test.com")
    const accountId = await insertTestAccount(ownerId)
    const categoryId = await insertTestCategory(ownerId)
    const transactionId = await insertTestTransaction({
      userId: ownerId,
      accountId,
      categoryId,
    })
    session.userId = otherId

    // Cuando: el otro usuario intenta eliminarla
    const result = await deleteTransaction(transactionId)

    // Entonces: la acción detecta que no se eliminó ninguna fila
    expect(result.success).toBe(false)
    expect(result.message).toBe("Transaction not found")

    // Y: la transacción sigue existiendo
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
    expect(rows).toHaveLength(1)
  })
})

describe("createBulkTransactions", () => {
  async function setupBulkUser(email: string) {
    const userId = await createTestUser(email)
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const defaultCategoryId = await insertTestCategory(userId, {
      name: DEFAULT_CATEGORY_NAME,
    })

    return { userId, accountId, defaultCategoryId }
  }

  it("T-15: guarda varias filas válidas y devuelve los tempIds guardados", async () => {
    // Dado: un usuario con cuenta y categoría por defecto
    const { userId, accountId, defaultCategoryId } =
      await setupBulkUser("t15@test.com")
    const rows = [buildBulkRow(0), buildBulkRow(1), buildBulkRow(2)]

    // Cuando: se guarda el lote
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId, rows })
    )

    // Entonces: todas las filas se guardaron
    expect(result?.success).toBe(true)
    expect(result?.saved).toBe(3)
    expect(result?.failed).toBe(0)
    expect(result?.message).toBe("Saved 3 transactions successfully")
    expect(result?.rows).toEqual([])
    expect(result?.savedTempIds).toEqual(["temp-0", "temp-1", "temp-2"])

    // Y: cada fila quedó con el usuario, la cuenta y la categoría por defecto
    const saved = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(saved).toHaveLength(3)

    for (const row of saved) {
      expect(row.accountId).toBe(accountId)
      expect(row.categoryId).toBe(defaultCategoryId)
      expect(row.transactionType).toBe("expense")
    }

    // Y: se revalidaron el listado y el dashboard
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/")
  })

  it("T-16: sin sesión retorna Unauthorized y no inserta", async () => {
    // Dado: no hay sesión activa
    const rows = [buildBulkRow(0)]

    // Cuando: se intenta guardar el lote
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId: 1, rows })
    )

    // Entonces: se rechaza sin tocar la base de datos
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")
    expect(result?.saved).toBe(0)
    expect(result?.failed).toBe(0)
    expect(result?.rows).toEqual([])
    expect(result?.savedTempIds).toEqual([])

    const saved = await db.select().from(transactions)
    expect(saved).toHaveLength(0)
  })

  it("T-17a: rechaza un accountId no numérico", async () => {
    // Dado: un usuario autenticado y un accountId inválido
    const userId = await createTestUser("t17a@test.com")
    session.userId = userId

    // Cuando: se intenta guardar el lote
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId: "abc", rows: [buildBulkRow(0)] })
    )

    // Entonces: falla antes de consultar la cuenta
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid bank account")
    expect(result?.saved).toBe(0)
  })

  it("T-17b: rechaza una cuenta inexistente o de otro usuario", async () => {
    // Dado: un usuario autenticado y una cuenta que no existe
    const userId = await createTestUser("t17b@test.com")
    session.userId = userId

    // Cuando: se intenta guardar el lote en esa cuenta
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId: 999999, rows: [buildBulkRow(0)] })
    )

    // Entonces: la query de cuentas (que filtra por userId) no la encuentra
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Bank account not found")
    expect(result?.saved).toBe(0)
  })

  it("T-18: rechaza un transactionsJson inválido", async () => {
    // Dado: un usuario con cuenta, pero un payload que no es JSON
    const userId = await createTestUser("t18@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)

    const formData = new FormData()
    formData.set("accountId", String(accountId))
    formData.set("transactionsJson", "{not-json")

    // Cuando: se intenta guardar el lote
    const result = await createBulkTransactions(null, formData)

    // Entonces: se rechaza el payload completo
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid transactions payload")
    expect(result?.saved).toBe(0)

    const saved = await db.select().from(transactions)
    expect(saved).toHaveLength(0)
  })

  it("T-19: guarda las filas válidas y reporta las inválidas", async () => {
    // Dado: un lote con una fila válida y otra con monto inválido
    const { accountId } = await setupBulkUser("t19@test.com")
    const rows = [buildBulkRow(0), buildBulkRow(1, { amount: "abc" })]

    // Cuando: se guarda el lote
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId, rows })
    )

    // Entonces: solo falla la fila inválida
    expect(result?.success).toBe(false)
    expect(result?.saved).toBe(1)
    expect(result?.failed).toBe(1)
    expect(result?.message).toBe("Saved 1 transaction, 1 failed")
    expect(result?.savedTempIds).toEqual(["temp-0"])
    expect(result?.rows).toHaveLength(1)
    expect(result?.rows[0].tempId).toBe("temp-1")
    expect(result?.rows[0].error).toContain("amount")

    // Y: en la base de datos solo quedó la fila válida
    const saved = await db.select().from(transactions)
    expect(saved).toHaveLength(1)
    expect(saved[0].amount).toBe("10.00")
  })

  it("T-20: resuelve la tasa una sola vez para todo el lote", async () => {
    // Dado: un usuario con moneda HNL y una tasa USD -> HNL de 24.5
    const { userId, accountId } = await setupBulkUser("t20@test.com")
    mockGetExchangeRate.mockResolvedValueOnce(24.5)
    const rows = [
      buildBulkRow(0, { amount: "10.00" }),
      buildBulkRow(1, { amount: "20.00" }),
    ]

    // Cuando: se guarda el lote en USD
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId, rows, currency: "USD" })
    )

    // Entonces: la tasa se pidió una sola vez
    expect(result?.success).toBe(true)
    expect(mockGetExchangeRate).toHaveBeenCalledTimes(1)
    expect(mockGetExchangeRate).toHaveBeenCalledWith("USD", "HNL")

    // Y: todas las filas comparten la tasa y el monto convertido
    const saved = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(saved).toHaveLength(2)

    for (const row of saved) {
      expect(row.transactionCurrency).toBe("USD")
      expect(row.exchangeRate).toBe("24.500000")
      expect(row.defaultCurrencyAtTransaction).toBe("HNL")
    }

    expect(saved.map((row) => row.amountInDefaultCurrency).sort()).toEqual([
      "245.00",
      "490.00",
    ])
  })

  it("T-21: usa la categoría por defecto cuando la fila no trae categoryId", async () => {
    // Dado: un usuario con categoría por defecto
    const { userId, accountId, defaultCategoryId } =
      await setupBulkUser("t21@test.com")
    const rows = [buildBulkRow(0), buildBulkRow(1, { categoryId: "" })]

    // Cuando: se guarda el lote
    const result = await createBulkTransactions(
      null,
      buildBulkFormData({ accountId, rows })
    )

    // Entonces: ambas filas usan la categoría por defecto
    expect(result?.success).toBe(true)

    const saved = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
    expect(saved).toHaveLength(2)
    expect(saved.every((row) => row.categoryId === defaultCategoryId)).toBe(
      true
    )
  })

  it("T-22: divide 101 filas en dos INSERT", async () => {
    // Dado: un usuario con categoría por defecto y 101 filas válidas
    const { userId, accountId } = await setupBulkUser("t22@test.com")
    const rows = Array.from({ length: 101 }, (_, index) => buildBulkRow(index))
    const insertSpy = vi.spyOn(db, "insert")

    try {
      // Cuando: se guarda el lote
      const result = await createBulkTransactions(
        null,
        buildBulkFormData({ accountId, rows })
      )

      // Entonces: se hicieron dos INSERT (100 + 1)
      expect(insertSpy).toHaveBeenCalledTimes(2)
      expect(result?.success).toBe(true)
      expect(result?.saved).toBe(101)
      expect(result?.failed).toBe(0)
      expect(result?.savedTempIds).toHaveLength(101)

      // Y: todas las filas quedaron persistidas
      const saved = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
      expect(saved).toHaveLength(101)
    } finally {
      insertSpy.mockRestore()
    }
  })
})

describe("transactions queries", () => {
  it("T-23: getTransactions devuelve datos de cuenta y categoría del usuario", async () => {
    // Dado: un usuario con una transacción y otro usuario con la suya
    const userId = await createTestUser("t23@test.com")
    const otherId = await createTestUser("t23-other@test.com")
    session.userId = userId

    const accountId = await insertTestAccount(userId, {
      accountName: "Cuenta Principal",
      bankName: "Banco Uno",
    })
    const categoryId = await insertTestCategory(userId, { name: "Comida" })
    await insertTestTransaction({ userId, accountId, categoryId })

    const otherAccountId = await insertTestAccount(otherId)
    const otherCategoryId = await insertTestCategory(otherId)
    await insertTestTransaction({
      userId: otherId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
    })

    // Cuando: se listan las transacciones
    const result = await getTransactions()

    // Entonces: solo aparece la del usuario y con los joins resueltos
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(1)
    const [item] = result.data
    expect(item.accountName).toBe("Cuenta Principal")
    expect(item.bankName).toBe("Banco Uno")
    expect(item.categoryName).toBe("Comida")
    expect(item.transactionDate).toBe("10-01-2026")
  })

  it("T-24: getTransactions sin sesión retorna unauthorized", async () => {
    // Dado: no hay sesión activa
    session.userId = null

    // Cuando: se listan las transacciones
    const result = await getTransactions()

    // Entonces: se rechaza con unauthorized
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.error.code).toBe("unauthorized")
  })

  it("T-25: getTransactionsPaginated pagina de 10 en 10", async () => {
    // Dado: un usuario con 11 transacciones en fechas distintas
    const userId = await createTestUser("t25@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId)

    for (let day = 1; day <= 11; day++) {
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: `${day}.00`,
        transactionDate: new Date(
          `2026-01-${String(day).padStart(2, "0")}T00:00:00`
        ),
      })
    }

    // Cuando: se piden la primera y la segunda página
    const firstPage = await getTransactionsPaginated(1, 10)
    const secondPage = await getTransactionsPaginated(2, 10)

    // Entonces: la primera trae 10 y avisa que hay más
    expect(firstPage.ok).toBe(true)
    if (!firstPage.ok) throw new Error("Expected ok result")
    expect(firstPage.data.items).toHaveLength(10)
    expect(firstPage.data.hasMore).toBe(true)
    expect(firstPage.data.items[0].transactionDate).toBe("11-01-2026")

    // Y: la segunda trae la restante y ya no hay más
    expect(secondPage.ok).toBe(true)
    if (!secondPage.ok) throw new Error("Expected ok result")
    expect(secondPage.data.items).toHaveLength(1)
    expect(secondPage.data.hasMore).toBe(false)
    expect(secondPage.data.items[0].transactionDate).toBe("01-01-2026")
  })

  it("T-26: getTransactionsById devuelve el detalle con la categoría", async () => {
    // Dado: una transacción con categoría con icono y color
    const userId = await createTestUser("t26@test.com")
    session.userId = userId
    const accountId = await insertTestAccount(userId)
    const categoryId = await insertTestCategory(userId, {
      name: "Transporte",
      icon: "car",
      color: "#2563eb",
    })
    const transactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      transactionDate: new Date("2026-02-05T00:00:00"),
    })

    // Cuando: se pide el detalle
    const result = await getTransactionsById({ id: transactionId })

    // Entonces: vienen los datos de la categoría y la fecha formateada
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.categoryName).toBe("Transporte")
    expect(result.data.categoryIcon).toBe("car")
    expect(result.data.categoryColor).toBe("#2563eb")
    expect(result.data.transactionDate).toBe("05-02-2026")
  })

  it("T-27: getTransactionsById con id inexistente retorna not_found", async () => {
    // Dado: un usuario autenticado sin transacciones
    const userId = await createTestUser("t27@test.com")
    session.userId = userId

    // Cuando: se pide un id que no existe
    const result = await getTransactionsById({ id: 999999 })

    // Entonces: retorna not_found
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.error.code).toBe("not_found")
  })

  it("T-28: getTransactionsById no expone transacciones de otro usuario", async () => {
    // Dado: una transacción que pertenece a otro usuario
    const ownerId = await createTestUser("t28-owner@test.com")
    const otherId = await createTestUser("t28-other@test.com")
    const accountId = await insertTestAccount(ownerId)
    const categoryId = await insertTestCategory(ownerId)
    const transactionId = await insertTestTransaction({
      userId: ownerId,
      accountId,
      categoryId,
    })
    session.userId = otherId

    // Cuando: el otro usuario pide el detalle
    const result = await getTransactionsById({ id: transactionId })

    // Entonces: la query filtra por userId y retorna not_found
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")
    expect(result.error.code).toBe("not_found")
  })
})
