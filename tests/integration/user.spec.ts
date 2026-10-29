import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { users } from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { eq } from "drizzle-orm"
import {
  createUser,
  loginUser,
  loginAsDemo,
  logout,
  updateDefaultCurrency,
} from "@/server/users/actions"
import { getUserById } from "@/server/users/queries"

const session = vi.hoisted(() => ({ userId: null as number | null }))

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock("@/lib/jwt", () => ({
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

import bcrypt from "bcryptjs"
import { setSessionCookie, clearSessionCookie } from "@/lib/jwt"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const mockHash = vi.mocked(
  (bcrypt as { hash: (val: string, salt: number | string) => Promise<string> }).hash
)
const mockCompare = vi.mocked(
  (bcrypt as { compare: (val: string, hash: string) => Promise<boolean> }).compare
)
const mockSetSessionCookie = vi.mocked(setSessionCookie)
const mockClearSessionCookie = vi.mocked(clearSessionCookie)
const mockRevalidatePath = vi.mocked(revalidatePath)
const mockRedirect = vi.mocked(redirect)

describe("createUser", () => {
  beforeEach(async () => {
    await truncateDatabase()
    mockHash.mockResolvedValue("hashed-password-123")
    mockCompare.mockResolvedValue(true)
  })

  it("U-01: registro exitoso con datos válidos", async () => {
    // Dado: datos de registro válidos (name, email, password ≥8, confirm igual)
    const formData = new FormData()
    formData.set("name", "Juan Pérez")
    formData.set("email", "juan@test.com")
    formData.set("password", "Password123")
    formData.set("confirmPassword", "Password123")

    // Cuando: se llama a la acción de crear usuario
    const result = await createUser(null, formData)

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Account created successfully")

    // Y: el usuario fue persistido en la base de datos
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "juan@test.com"))

    expect(dbUser).toBeDefined()
    expect(dbUser.name).toBe("Juan Pérez")
    expect(dbUser.email).toBe("juan@test.com")

    // Y: el password NO está en texto plano (fue hasheado)
    expect(dbUser.password).not.toBe("Password123")
    expect(dbUser.password).toBe("hashed-password-123")
  })

  it("U-02: email duplicado retorna error", async () => {
    // Dado: ya existe un usuario con ese email
    await db.insert(users).values({
      name: "Existente",
      email: "dup@test.com",
      password: "hashed",
    })

    const formData = new FormData()
    formData.set("name", "Duplicado")
    formData.set("email", "dup@test.com")
    formData.set("password", "Password123")
    formData.set("confirmPassword", "Password123")

    // Cuando: se intenta crear usuario con email duplicado
    const result = await createUser(null, formData)

    // Entonces: retorna error de validación en el campo email
    expect(result?.success).toBe(false)
    expect(result?.error?.email).toBe("This email is already registered")
  })

  it("U-03: contraseñas no coinciden retorna error", async () => {
    // Dado: password y confirmPassword son diferentes
    const formData = new FormData()
    formData.set("name", "Test")
    formData.set("email", "test@test.com")
    formData.set("password", "Password123")
    formData.set("confirmPassword", "Password456")

    // Cuando: se intenta registrar
    const result = await createUser(null, formData)

    // Entonces: retorna error en confirmPassword
    expect(result?.success).toBe(false)
    expect(result?.error?.confirmPassword).toBeDefined()
  })

  it("U-04: password corta (<8) retorna error", async () => {
    // Dado: password con menos de 8 caracteres
    const formData = new FormData()
    formData.set("name", "Test")
    formData.set("email", "short@test.com")
    formData.set("password", "12345")
    formData.set("confirmPassword", "12345")

    // Cuando: se intenta registrar
    const result = await createUser(null, formData)

    // Entonces: retorna error en password
    expect(result?.success).toBe(false)
    expect(result?.error?.password).toBeDefined()
  })
})

describe("loginUser", () => {
  beforeEach(async () => {
    await truncateDatabase()
    mockCompare.mockResolvedValue(true)
  })

  it("U-06: credenciales válidas login exitoso", async () => {
    // Dado: usuario existe en BD con password hasheado
    await db.insert(users).values({
      name: "Login Test",
      email: "login@test.com",
      password: "hashed-password-123",
    })

    const formData = new FormData()
    formData.set("email", "login@test.com")
    formData.set("password", "Password123")

    // Cuando: se llama a login con credenciales correctas
    const result = await loginUser(null, formData)

    // Entonces: retorna éxito y establece sesión
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Logged in successfully")
    expect(mockSetSessionCookie).toHaveBeenCalledWith(expect.any(Number))
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard")
  })

  it("U-07: email inexistente retorna error", async () => {
    // Dado: el email no existe en la base de datos
    const formData = new FormData()
    formData.set("email", "noexiste@test.com")
    formData.set("password", "Password123")

    // Cuando: se intenta login con email inexistente
    const result = await loginUser(null, formData)

    // Entonces: retorna error de credenciales inválidas
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid email or password")
  })

  it("U-08: password incorrecto retorna error", async () => {
    // Dado: usuario existe pero password es incorrecto
    await db.insert(users).values({
      name: "Login Test",
      email: "login2@test.com",
      password: "hashed-password-123",
    })

    mockCompare.mockResolvedValueOnce(false)

    const formData = new FormData()
    formData.set("email", "login2@test.com")
    formData.set("password", "WrongPassword123")

    // Cuando: se intenta login con password incorrecto
    const result = await loginUser(null, formData)

    // Entonces: retorna error de credenciales inválidas
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid email or password")
  })

  it("U-09: datos inválidos (email vacío) retorna error de validación", async () => {
    // Dado: email vacío (fallaría zod validation)
    const formData = new FormData()
    formData.set("email", "")
    formData.set("password", "Password123")

    // Cuando: se intenta login con datos inválidos
    const result = await loginUser(null, formData)

    // Entonces: retorna error de validación en email
    expect(result?.success).toBe(false)
    expect(result?.error?.email).toBeDefined()
  })
})

describe("loginAsDemo", () => {
  beforeEach(async () => {
    await truncateDatabase()
    vi.resetAllMocks()
  })

  it("U-10: establece sesión demo y redirige a /dashboard", async () => {
    // Dado: no hay sesión previa
    // Cuando: se llama a loginAsDemo
    await loginAsDemo()

    // Entonces: se establece la cookie con userId=1
    expect(mockSetSessionCookie).toHaveBeenCalledWith(1)

    // Y: se redirige a /dashboard
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard")
  })
})

describe("logout", () => {
  beforeEach(async () => {
    await truncateDatabase()
    vi.clearAllMocks()
  })

  it("U-11: limpia la cookie de sesión y redirige a /", async () => {
    // Cuando: se cierra la sesión
    await logout()

    // Entonces: se elimina la cookie de sesión
    expect(mockClearSessionCookie).toHaveBeenCalledTimes(1)

    // Y: se redirige al inicio
    expect(mockRedirect).toHaveBeenCalledWith("/")
  })
})

describe("updateDefaultCurrency", () => {
  beforeEach(async () => {
    await truncateDatabase()
    vi.clearAllMocks()
    session.userId = null
  })

  it("U-13: moneda válida actualiza al usuario y revalida rutas", async () => {
    // Dado: un usuario autenticado con la moneda por defecto HNL
    const [user] = await db
      .insert(users)
      .values({
        name: "Currency Test",
        email: "currency@test.com",
        password: "hashed",
      })
      .$returningId()
    session.userId = user.id

    const formData = new FormData()
    formData.set("currency", "USD")

    // Cuando: se actualiza la moneda por defecto
    const result = await updateDefaultCurrency(null, formData)

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Default currency updated successfully")

    // Y: la moneda quedó persistida en la base de datos
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(dbUser.defaultCurrency).toBe("USD")

    // Y: se revalidaron las rutas afectadas
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard")
  })

  it("U-14: moneda inválida retorna error de validación y no persiste", async () => {
    // Dado: un usuario autenticado
    const [user] = await db
      .insert(users)
      .values({
        name: "Currency Test",
        email: "currency2@test.com",
        password: "hashed",
      })
      .$returningId()
    session.userId = user.id

    const formData = new FormData()
    formData.set("currency", "XXX")

    // Cuando: se intenta guardar una moneda no soportada
    const result = await updateDefaultCurrency(null, formData)

    // Entonces: retorna error de validación en currency
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid currency")
    expect(result?.error?.currency).toBe("Currency must be HNL, USD, or EUR")

    // Y: la moneda original no cambió
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(dbUser.defaultCurrency).toBe("HNL")

    // Y: no se revalidó nada
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("U-15: sin sesión retorna Unauthorized y no persiste", async () => {
    // Dado: existe un usuario, pero no hay sesión activa
    const [user] = await db
      .insert(users)
      .values({
        name: "Currency Test",
        email: "currency3@test.com",
        password: "hashed",
      })
      .$returningId()

    const formData = new FormData()
    formData.set("currency", "USD")

    // Cuando: se intenta actualizar la moneda sin sesión
    const result = await updateDefaultCurrency(null, formData)

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: el usuario no fue modificado
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(dbUser.defaultCurrency).toBe("HNL")
  })
})

describe("getUserById", () => {
  beforeEach(async () => {
    await truncateDatabase()
    vi.clearAllMocks()
  })

  it("U-16: usuario encontrado devuelve id, name, email y defaultCurrency", async () => {
    // Dado: un usuario persistido con moneda EUR
    const [user] = await db
      .insert(users)
      .values({
        name: "Ana",
        email: "ana@test.com",
        password: "hashed",
        defaultCurrency: "EUR",
      })
      .$returningId()

    // Cuando: se busca por su id
    const result = await getUserById(user.id)

    // Entonces: retorna el usuario con los campos esperados
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      id: user.id,
      name: "Ana",
      email: "ana@test.com",
      defaultCurrency: "EUR",
    })
  })

  it("U-17: usuario inexistente devuelve error", async () => {
    // Cuando: se busca un id que no existe
    const result = await getUserById(999_999)

    // Entonces: retorna error sin datos
    expect(result.success).toBe(false)
    expect(result.error).toBe("User not found")
    expect(result.data).toBeUndefined()
  })
})
