import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock de Drizzle: solo necesitamos controlar select().from().where()
// porque checkDuplicateAccount no hace inserts ni updates.
const dbMock = vi.hoisted(() => {
  const where = vi.fn(async (): Promise<unknown[]> => [])
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { select, from, where }
})

vi.mock("@/db", () => ({
  db: {
    select: dbMock.select,
  },
}))

import { checkDuplicateAccount } from "@/server/bank-accounts/actions"

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.where.mockReset()
  dbMock.where.mockResolvedValue([])
})

describe("checkDuplicateAccount (unit)", () => {
  it("BA-13: detecta duplicado por accountNumber", async () => {
    // Dado: existe una cuenta con el mismo número pero distinto nombre
    dbMock.where.mockResolvedValueOnce([
      { accountNumber: "1234567890", accountName: "Otra cuenta" },
    ])

    // Cuando: se valida un número repetido
    const result = await checkDuplicateAccount({
      accountNumber: "1234567890",
      accountName: "Cuenta nueva",
      userId: 1,
    })

    // Entonces: marca duplicado solo por número
    expect(result.isDuplicate).toBe(true)
    expect(result.errors).toMatchObject({
      accountNumber: "This account number is already registered",
    })
    expect(result.errors).not.toHaveProperty("accountName")
  })

  it("BA-14: detecta duplicado por accountName", async () => {
    // Dado: existe una cuenta con el mismo nombre pero distinto número
    dbMock.where.mockResolvedValueOnce([
      { accountNumber: "9999999999", accountName: "Cuenta duplicada" },
    ])

    // Cuando: se valida un nombre repetido
    const result = await checkDuplicateAccount({
      accountNumber: "1234567890",
      accountName: "Cuenta duplicada",
      userId: 1,
    })

    // Entonces: marca duplicado solo por nombre
    expect(result.isDuplicate).toBe(true)
    expect(result.errors).toMatchObject({
      accountName:
        "You already have an account registered with this account name",
    })
    expect(result.errors).not.toHaveProperty("accountNumber")
  })

  it("BA-15: no marca duplicado cuando no hay coincidencias", async () => {
    // Dado: no existe ninguna cuenta con esos datos
    dbMock.where.mockResolvedValueOnce([])

    // Cuando: se valida una cuenta única
    const result = await checkDuplicateAccount({
      accountNumber: "1234567890",
      accountName: "Cuenta única",
      userId: 1,
    })

    // Entonces: no es duplicado y no hay errores
    expect(result.isDuplicate).toBe(false)
    expect(result.errors).toEqual({})
  })
})
