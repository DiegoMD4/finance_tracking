import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  bankAccounts,
  categories,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { eq } from "drizzle-orm"
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/server/categories/actions"
import {
  getCategories,
  getCategoryById,
} from "@/server/categories/queries"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"

const session = vi.hoisted(() => ({ userId: null as number | null }))

vi.mock("@/lib/jwt", () => ({
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { revalidatePath } from "next/cache"

const mockRevalidatePath = vi.mocked(revalidatePath)

const validCategoryFields = {
  name: "Comida",
  icon: "utensils",
  color: "#f97316",
}

function buildCategoryFormData(
  overrides: Record<string, string> = {}
): FormData {
  const formData = new FormData()
  const values = { ...validCategoryFields, ...overrides }

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

let accountSequence = 0

async function insertTestAccount(userId: number): Promise<number> {
  accountSequence += 1

  const [account] = await db
    .insert(bankAccounts)
    .values({
      accountNumber: `CAT-${accountSequence}`,
      bankName: "Banco Test",
      userId,
    })
    .$returningId()

  return account.id
}

async function insertTestTransaction({
  userId,
  accountId,
  categoryId,
  amount = "100.00",
  transactionType = "expense",
  transactionDate = new Date("2026-01-10"),
}: {
  userId: number
  accountId: number
  categoryId: number
  amount?: string
  transactionType?: "income" | "expense"
  transactionDate?: Date
}): Promise<number> {
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId,
      accountId,
      categoryId,
      amount,
      transactionType,
      transactionDate,
    })
    .$returningId()

  return transaction.id
}

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  session.userId = null
})

describe("createCategory", () => {
  it("C-01: crea una categoría con datos válidos", async () => {
    // Dado: un usuario autenticado y datos válidos
    const userId = await createTestUser("c01@test.com")
    session.userId = userId

    // Cuando: se crea la categoría
    const result = await createCategory(null, buildCategoryFormData())

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Category created successfully")

    // Y: la categoría quedó persistida con el userId de la sesión
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))

    expect(category).toBeDefined()
    expect(category.name).toBe(validCategoryFields.name)
    expect(category.icon).toBe(validCategoryFields.icon)
    expect(category.color).toBe(validCategoryFields.color)
    expect(category.userId).toBe(userId)

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/categories")
  })

  it("C-02: sin sesión retorna Unauthorized y no inserta", async () => {
    // Dado: no hay sesión activa (session.userId = null)

    // Cuando: se intenta crear una categoría
    const result = await createCategory(null, buildCategoryFormData())

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: no se insertó nada
    const rows = await db.select().from(categories)
    expect(rows).toHaveLength(0)
  })

  it("C-03: nombre vacío retorna error de validación", async () => {
    // Dado: un usuario autenticado y un nombre vacío
    const userId = await createTestUser("c03@test.com")
    session.userId = userId

    // Cuando: se intenta crear la categoría
    const result = await createCategory(
      null,
      buildCategoryFormData({ name: "" })
    )

    // Entonces: Zod rechaza el campo y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.name).toBe("Category name is required")

    const rows = await db.select().from(categories)
    expect(rows).toHaveLength(0)
  })

  it("C-04: icon inválido retorna error de validación", async () => {
    // Dado: un usuario autenticado y un icon fuera de CATEGORY_ICON_KEYS
    const userId = await createTestUser("c04@test.com")
    session.userId = userId

    // Cuando: se intenta crear la categoría
    const result = await createCategory(
      null,
      buildCategoryFormData({ icon: "icono-invalido" })
    )

    // Entonces: Zod rechaza el icon y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.icon).toBe("Please select a valid icon")

    const rows = await db.select().from(categories)
    expect(rows).toHaveLength(0)
  })

  it("C-05: color no hexadecimal retorna error de validación", async () => {
    // Dado: un usuario autenticado y un color que no es hex
    const userId = await createTestUser("c05@test.com")
    session.userId = userId

    // Cuando: se intenta crear la categoría
    const result = await createCategory(
      null,
      buildCategoryFormData({ color: "rojo" })
    )

    // Entonces: Zod rechaza el color y no se persiste nada
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Invalid form data")
    expect(result?.error?.color).toBe(
      "Color must be a valid hex code, e.g. #64748b"
    )

    const rows = await db.select().from(categories)
    expect(rows).toHaveLength(0)
  })
})

describe("updateCategory", () => {
  it("C-06: actualiza una categoría propia con datos válidos", async () => {
    // Dado: un usuario autenticado con una categoría existente
    const userId = await createTestUser("c06@test.com")
    session.userId = userId
    const categoryId = await insertTestCategory(userId)

    // Cuando: se actualiza con datos nuevos
    const result = await updateCategory(
      null,
      buildCategoryFormData({
        id: String(categoryId),
        name: "Transporte",
        icon: "car",
        color: "#0ea5e9",
      })
    )

    // Entonces: retorna éxito
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Category updated successfully")

    // Y: todos los campos quedaron actualizados en la base de datos
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, categoryId))

    expect(category.name).toBe("Transporte")
    expect(category.icon).toBe("car")
    expect(category.color).toBe("#0ea5e9")

    // Y: se revalidó la ruta del listado
    expect(mockRevalidatePath).toHaveBeenCalledWith("/categories")
  })

  it("C-06b (extra): id inexistente retorna error y no revalida", async () => {
    // Dado: un usuario autenticado y un id que no existe
    const userId = await createTestUser("c06b@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateCategory(
      null,
      buildCategoryFormData({ id: "999999", name: "Fantasma" })
    )

    // Entonces: la acción detecta que no se actualizó ninguna fila
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Category not found")

    // Y: no se creó ninguna categoría ni se revalidó
    const rows = await db.select().from(categories)
    expect(rows).toHaveLength(0)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("C-06c (extra): no actualiza la categoría de otro usuario", async () => {
    // Dado: una categoría que pertenece a otro usuario
    const ownerId = await createTestUser("c06c-owner@test.com")
    const otherId = await createTestUser("c06c-other@test.com")
    const categoryId = await insertTestCategory(ownerId, {
      name: "Categoría ajena",
    })
    session.userId = otherId

    // Cuando: el otro usuario intenta actualizarla
    const result = await updateCategory(
      null,
      buildCategoryFormData({ id: String(categoryId), name: "Robada" })
    )

    // Entonces: el filtro por userId no afecta ninguna fila
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Category not found")

    // Y: la categoría original queda intacta
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
    expect(category.name).toBe("Categoría ajena")
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("C-07: sin id retorna error", async () => {
    // Dado: un usuario autenticado y un formulario sin id
    const userId = await createTestUser("c07@test.com")
    session.userId = userId

    // Cuando: se intenta actualizar
    const result = await updateCategory(null, buildCategoryFormData())

    // Entonces: retorna error de id faltante
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Missing or invalid category ID")
  })

  it("C-08: sin sesión retorna Unauthorized y no actualiza", async () => {
    // Dado: existe una categoría, pero no hay sesión activa
    const userId = await createTestUser("c08@test.com")
    const categoryId = await insertTestCategory(userId)
    session.userId = null

    // Cuando: se intenta actualizar
    const result = await updateCategory(
      null,
      buildCategoryFormData({ id: String(categoryId), name: "Intento" })
    )

    // Entonces: retorna Unauthorized
    expect(result?.success).toBe(false)
    expect(result?.message).toBe("Unauthorized: a valid session is required")

    // Y: la categoría no fue modificada
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
    expect(category.name).toBe("Categoría Test")
  })
})

describe("deleteCategory", () => {
  it("C-09: elimina una categoría propia", async () => {
    // Dado: un usuario autenticado con su categoría por defecto y otra categoría
    const userId = await createTestUser("c09@test.com")
    session.userId = userId
    await insertTestCategory(userId, { name: DEFAULT_CATEGORY_NAME })
    const categoryId = await insertTestCategory(userId, { name: "Comida" })

    // Cuando: se elimina la categoría
    const result = await deleteCategory(categoryId)

    // Entonces: retorna éxito
    expect(result.success).toBe(true)
    expect(result.message).toBe("Category deleted")

    // Y: la fila ya no existe
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
    expect(rows).toHaveLength(0)

    // Y: se revalidaron las rutas afectadas
    expect(mockRevalidatePath).toHaveBeenCalledWith("/categories")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/transactions")
  })

  it("C-10: no permite eliminar la categoría por defecto", async () => {
    // Dado: un usuario autenticado con su categoría por defecto
    const userId = await createTestUser("c10@test.com")
    session.userId = userId
    const defaultCategoryId = await insertTestCategory(userId, {
      name: DEFAULT_CATEGORY_NAME,
    })

    // Cuando: se intenta eliminar la categoría por defecto
    const result = await deleteCategory(defaultCategoryId)

    // Entonces: retorna el error específico
    expect(result.success).toBe(false)
    expect(result.message).toBe("The default category can't be deleted")

    // Y: la categoría sigue existiendo
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, defaultCategoryId))
    expect(rows).toHaveLength(1)
  })

  it("C-11: id inexistente retorna Category not found", async () => {
    // Dado: un usuario autenticado con default (deleteCategory lo resuelve primero)
    const userId = await createTestUser("c11@test.com")
    session.userId = userId
    await insertTestCategory(userId, { name: DEFAULT_CATEGORY_NAME })

    // Cuando: se intenta eliminar un id que no existe
    const result = await deleteCategory(999_999)

    // Entonces: retorna Category not found
    expect(result.success).toBe(false)
    expect(result.message).toBe("Category not found")
  })

  it("C-12: no permite eliminar la categoría de otro usuario", async () => {
    // Dado: el usuario tiene default, y existe una categoría de otro usuario
    const ownerId = await createTestUser("c12-owner@test.com")
    const otherId = await createTestUser("c12-other@test.com")
    session.userId = otherId
    await insertTestCategory(otherId, { name: DEFAULT_CATEGORY_NAME })
    const foreignCategoryId = await insertTestCategory(ownerId, {
      name: "Categoría ajena",
    })

    // Cuando: se intenta eliminar la categoría ajena
    const result = await deleteCategory(foreignCategoryId)

    // Entonces: retorna el error de propiedad
    expect(result.success).toBe(false)
    expect(result.message).toBe("You can only delete your own categories")

    // Y: la categoría ajena sigue existiendo
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, foreignCategoryId))
    expect(rows).toHaveLength(1)
  })

  it("C-13: reasigna las transacciones a la categoría por defecto", async () => {
    // Dado: default + categoría a borrar + dos transacciones (una en cada una)
    const userId = await createTestUser("c13@test.com")
    session.userId = userId
    const defaultCategoryId = await insertTestCategory(userId, {
      name: DEFAULT_CATEGORY_NAME,
    })
    const categoryId = await insertTestCategory(userId, { name: "Comida" })
    const accountId = await insertTestAccount(userId)

    const affectedTransactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId,
    })
    const untouchedTransactionId = await insertTestTransaction({
      userId,
      accountId,
      categoryId: defaultCategoryId,
    })

    // Cuando: se elimina la categoría
    const result = await deleteCategory(categoryId)

    // Entonces: la operación fue exitosa
    expect(result.success).toBe(true)

    // Y: la transacción de la categoría borrada apunta ahora al default
    const [affectedTransaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, affectedTransactionId))
    expect(affectedTransaction.categoryId).toBe(defaultCategoryId)

    // Y: la transacción que ya estaba en el default no cambió
    const [untouchedTransaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, untouchedTransactionId))
    expect(untouchedTransaction.categoryId).toBe(defaultCategoryId)
  })
})

describe("category queries", () => {
  it("C-14: getCategories devuelve las propias y las globales", async () => {
    // Dado: categorías de dos usuarios y una global
    const userId = await createTestUser("c14@test.com")
    const otherId = await createTestUser("c14-other@test.com")
    session.userId = userId

    await insertTestCategory(userId, { name: "Comida" })
    await insertTestCategory(null, {
      name: "Transporte",
      icon: "car",
      color: "#0ea5e9",
    })
    await insertTestCategory(otherId, { name: "Ocio" })

    // Cuando: se listan las categorías
    const result = await getCategories()

    // Entonces: retorna ok con las propias + la global
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    const names = result.data.map((category) => category.name)
    expect(result.data).toHaveLength(2)
    expect(names).toContain("Comida")
    expect(names).toContain("Transporte")
    expect(names).not.toContain("Ocio")
  })

  it("C-15: getCategories sin sesión retorna unauthorized", async () => {
    // Dado: no hay sesión activa
    session.userId = null

    // Cuando: se listan las categorías
    const result = await getCategories()

    // Entonces: retorna error unauthorized
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("unauthorized")
  })

  it("C-16: getCategoryById devuelve la categoría del usuario", async () => {
    // Dado: un usuario con una categoría
    const userId = await createTestUser("c16@test.com")
    session.userId = userId
    const categoryId = await insertTestCategory(userId, { name: "Comida" })

    // Cuando: se busca por id
    const result = await getCategoryById({ id: categoryId })

    // Entonces: retorna ok con la categoría
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.categoryId).toBe(categoryId)
    expect(result.data.name).toBe("Comida")
    expect(result.data.userId).toBe(userId)
  })

  it("C-16b (extra): getCategoryById no devuelve categorías de otro usuario", async () => {
    // Dado: una categoría que pertenece a otro usuario
    const ownerId = await createTestUser("c16b-owner@test.com")
    const otherId = await createTestUser("c16b-other@test.com")
    const categoryId = await insertTestCategory(ownerId, {
      name: "Categoría ajena",
    })
    session.userId = otherId

    // Cuando: el otro usuario intenta buscarla
    const result = await getCategoryById({ id: categoryId })

    // Entonces: no la encuentra (el filtro por userId la excluye)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("not_found")
  })

  it("C-17: getCategoryById con id inexistente retorna not_found", async () => {
    // Dado: un usuario autenticado sin esa categoría
    const userId = await createTestUser("c17@test.com")
    session.userId = userId

    // Cuando: se busca un id que no existe
    const result = await getCategoryById({ id: 999_999 })

    // Entonces: retorna not_found
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("Expected error result")

    expect(result.error.code).toBe("not_found")
  })
})
