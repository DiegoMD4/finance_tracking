import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock compartido de Drizzle: exponemos las funciones internas para poder
// controlar la cadena select().from().where() desde cada test.
const dbMock = vi.hoisted(() => {
  const where = vi.fn(async (): Promise<unknown[]> => [])
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  const values = vi.fn(async (): Promise<unknown> => undefined)
  const insert = vi.fn(() => ({ values }))
  return { select, from, where, insert, values }
})

vi.mock("@/db", () => ({
  db: {
    select: dbMock.select,
    insert: dbMock.insert,
  },
}))

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock("@/server/session", () => ({
  getSessionUserInfo: vi.fn(),
}))

import { db } from "@/db"
import bcrypt from "bcryptjs"
import { getSessionUserInfo } from "@/server/session"
import { createUser, getSessionStatus } from "@/server/users/actions"
import {
  getUserById,
  isDbUnavailableError,
  matchesDbUnavailable,
} from "@/server/users/queries"

const mockDb = vi.mocked(db)
const mockGetSessionUserInfo = vi.mocked(getSessionUserInfo)
const mockHash = vi.mocked(
  (bcrypt as { hash: (val: string, salt: number | string) => Promise<string> }).hash
)

beforeEach(() => {
  vi.clearAllMocks()
  // Cada test arranca con una BD "vacía" y un insert exitoso por defecto.
  dbMock.where.mockReset()
  dbMock.where.mockResolvedValue([])
  dbMock.values.mockReset()
  dbMock.values.mockResolvedValue(undefined)
})

describe("createUser (unit)", () => {
  it("U-05: bcrypt.hash es llamado con salt 10", async () => {
    mockHash.mockResolvedValue("hashed-password")

    const formData = new FormData()
    formData.set("name", "Test")
    formData.set("email", "hash@test.com")
    formData.set("password", "Password123")
    formData.set("confirmPassword", "Password123")

    const result = await createUser(null, formData)

    expect(result?.success).toBe(true)
    expect(mockHash).toHaveBeenCalledWith("Password123", 10)
    expect(mockDb.insert).toHaveBeenCalled()
  })
})

describe("getSessionStatus (unit)", () => {
  it("U-12: devuelve authenticated cuando hay usuario en sesión", async () => {
    mockGetSessionUserInfo.mockResolvedValue({
      status: "authenticated",
      user: {
        id: 1,
        name: "Ana",
        email: "ana@test.com",
        defaultCurrency: "HNL",
      },
    })

    await expect(getSessionStatus()).resolves.toBe("authenticated")
  })

  it("U-12: devuelve unauthenticated cuando no hay sesión válida", async () => {
    mockGetSessionUserInfo.mockResolvedValue({
      status: "unauthenticated",
      reason: "no-token",
    })

    await expect(getSessionStatus()).resolves.toBe("unauthenticated")
  })

  it("U-12: devuelve db-unavailable cuando la base no responde", async () => {
    mockGetSessionUserInfo.mockResolvedValue({ status: "db-unavailable" })

    await expect(getSessionStatus()).resolves.toBe("db-unavailable")
  })
})

describe("getUserById (unit)", () => {
  it("U-18: DB caída devuelve success false y dbUnavailable true", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const dbError = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:3306"),
      { code: "ECONNREFUSED" }
    )
    dbMock.where.mockRejectedValueOnce(dbError)

    const result = await getUserById(1)

    expect(result.success).toBe(false)
    expect(result.error).toBe("Failed to fetch user")
    expect(result.dbUnavailable).toBe(true)
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})

describe("isDbUnavailableError (unit)", () => {
  it("U-19: detecta DB unavailable en una causa anidada profunda", () => {
    const error = new Error("outer", {
      cause: new Error("inner", {
        cause: { code: "ETIMEDOUT", errno: -4037 },
      }),
    })

    expect(isDbUnavailableError(error)).toBe(true)
  })

  it("U-19: devuelve false cuando ninguna causa es de DB unavailable", () => {
    const error = new Error("outer", { cause: new Error("inner") })

    expect(isDbUnavailableError(error)).toBe(false)
  })
})

describe("matchesDbUnavailable (unit)", () => {
  it.each([-4078, -4037, -4039])(
    "U-20: reconoce el errno %i como DB unavailable",
    (errno) => {
      expect(matchesDbUnavailable({ errno })).toBe(true)
    }
  )

  it("U-20: devuelve false para un errno desconocido", () => {
    expect(matchesDbUnavailable({ errno: -1 })).toBe(false)
  })
})
