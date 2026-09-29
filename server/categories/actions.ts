"use server"

import { categorySchema } from "@/app/(app)/categories/schema"
import { db } from "@/db"
import { categories, transactions } from "@/db/schema/schema"
import { getDefaultCategory } from "@/server/categories/queries"
import {
  CategoriesActionState,
  CreateCategory,
  UpdateCategory,
} from "@/types/categories.types"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"
import { getSessionUserId } from "@/lib/jwt"

export const createCategory = async (
  prevState: CategoriesActionState,
  formData: FormData
): Promise<CreateCategory | undefined> => {
  const rawFields = {
    name: formData.get("name")?.toString() || "",
    icon: formData.get("icon")?.toString() || "",
    color: formData.get("color")?.toString() || "",
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
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
    await db.insert(categories).values({
      name,
      icon,
      color,
      userId,
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

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
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
      .where(
        and(
          eq(categories.categoryId, categoryId),
          eq(categories.userId, userId)
        )
      )

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
  const userId = await getSessionUserId()
  if (!userId) {
    return { success: false, message: "Unauthorized: a valid session is required" }
  }

  try {
    const defaultCategory = await getDefaultCategory(userId)

    if (!defaultCategory.ok) {
      return {
        success: false,
        message: "Couldn't resolve the default category, try again later",
      }
    }

    const defaultCategoryId = defaultCategory.data

    if (id === defaultCategoryId) {
      return {
        success: false,
        message: "The default category can't be deleted",
      }
    }

    const [target] = await db
      .select({ userId: categories.userId })
      .from(categories)
      .where(eq(categories.categoryId, id))
      .limit(1)

    if (!target) {
      return { success: false, message: "Category not found" }
    }

    if (target.userId !== userId) {
      return {
        success: false,
        message: "You can only delete your own categories",
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ categoryId: defaultCategoryId })
        .where(
          and(
            eq(transactions.categoryId, id),
            eq(transactions.userId, userId)
          )
        )

      await tx
        .delete(categories)
        .where(
          and(eq(categories.categoryId, id), eq(categories.userId, userId))
        )
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
