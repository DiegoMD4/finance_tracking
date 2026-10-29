import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock de Drizzle: getDefaultCategory encadena
// select().from().where().limit() y puede ejecutar dos queries.
const dbMock = vi.hoisted(() => {
  const limit = vi.fn(async (): Promise<unknown[]> => [])
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { select, from, where, limit }
})

vi.mock("@/db", () => ({
  db: {
    select: dbMock.select,
  },
}))

import { getDefaultCategory } from "@/server/categories/queries"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.limit.mockReset()
  dbMock.limit.mockResolvedValue([])
})

describe("getDefaultCategory (unit)", () => {
  it("C-18: devuelve la categoría por defecto del usuario", async () => {
    // Dado: el usuario tiene su propia categoría "Miscellaneous / Others"
    dbMock.limit.mockResolvedValueOnce([{ categoryId: 7 }])

    // Cuando: se resuelve el default
    const result = await getDefaultCategory(1)

    // Entonces: retorna el id del usuario sin consultar el global
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toBe(7)
    expect(dbMock.limit).toHaveBeenCalledTimes(1)
  })

  it("C-19: cae al default global si el usuario no tiene uno", async () => {
    // Dado: la primera query no encuentra default del usuario,
    // pero la segunda sí encuentra el global (userId null)
    dbMock.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ categoryId: 42 }])

    // Cuando: se resuelve el default
    const result = await getDefaultCategory(1)

    // Entonces: retorna el id global
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toBe(42)
    expect(dbMock.limit).toHaveBeenCalledTimes(2)
  })

  it("C-20: retorna not_found si no existe ningún default", async () => {
    // Dado: no hay default del usuario ni global
    dbMock.limit.mockResolvedValue([])

    // Cuando: se resuelve el default
    const result = await getDefaultCategory(1)

    // Entonces: retorna not_found con el nombre esperado en el mensaje
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("not_found")
    expect(result.error.message).toContain(DEFAULT_CATEGORY_NAME)
    expect(dbMock.limit).toHaveBeenCalledTimes(2)
  })
})
