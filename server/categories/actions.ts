"use server"

import { categorySchema } from "@/app/categories/schema"
import { db } from "@/db"
import { categories, transactions } from "@/db/schema/schema"
import { getDefaultCategory } from "@/server/categories/queries"
import {
  CategoriesActionState,
  CreateCategory,
  UpdateCategory,
} from "@/types/categories.types"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"

export const createCategory = async (
  prevState: CategoriesActionState,
  formData: FormData
): Promise<CreateCategory | undefined> => {
  const rawFields = {
    name: formData.get("name")?.toString() || "",
    icon: formData.get("icon")?.toString() || "",
    color: formData.get("color")?.toString() || "",
  }

  const validatedFields = categorySchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        name: fieldErrors.properties?.name?.errors[0],
        icon: fieldErrors.properties?.icon?.errors[0],
        color: fieldErrors.properties?.color?.errors[0],
      },
      fields: rawFields,
    }
  }

  const { name, icon, color } = validatedFields.data

  try {
    await db.insert(categories).values({
      name,
      icon,
      color,
      userId: 1,
    })

    revalidatePath("/categories")

    return {
      success: true,
      message: "Category created successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error creating category:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export const updateCategory = async (
  prevState: CategoriesActionState,
  formData: FormData
): Promise<UpdateCategory | undefined> => {
  const idRaw = formData.get("id")?.toString()
  const categoryId = idRaw ? parseInt(idRaw, 10) : null
  const rawFields = {
    name: formData.get("name")?.toString() || "",
    icon: formData.get("icon")?.toString() || "",
    color: formData.get("color")?.toString() || "",
  }

  if (!categoryId || isNaN(categoryId)) {
    return {
      success: false,
      message: "Missing or invalid category ID",
      fields: rawFields,
    }
  }

  const validatedFields = categorySchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        name: fieldErrors.properties?.name?.errors[0],
        icon: fieldErrors.properties?.icon?.errors[0],
        color: fieldErrors.properties?.color?.errors[0],
      },
      fields: rawFields,
    }
  }

  const { name, icon, color } = validatedFields.data

  try {
    await db
      .update(categories)
      .set({ name, icon, color })
      .where(eq(categories.categoryId, categoryId))

    revalidatePath("/categories")

    return {
      success: true,
      message: "Category updated successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error updating category:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export const deleteCategory = async (id: number) => {
  try {
    const defaultCategory = await getDefaultCategory()

    if (!defaultCategory.success || !defaultCategory.categoryId) {
      return {
        success: false,
        message: "Couldn't resolve the default category, try again later",
      }
    }

    if (id === defaultCategory.categoryId) {
      return {
        success: false,
        message: "The default category can't be deleted",
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ categoryId: defaultCategory.categoryId! })
        .where(eq(transactions.categoryId, id))

      await tx.delete(categories).where(eq(categories.categoryId, id))
    })

    revalidatePath("/categories")
    revalidatePath("/transactions")

    return { success: true, message: "Category deleted" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return { success: false, message: errorMessage }
  }
}
