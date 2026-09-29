import { db } from "@/db"
import { categories } from "@/db/schema/schema"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import { getSessionUserId } from "@/lib/jwt"
import { err, ok, type Result } from "@/types/result"
import type { Category } from "@/types/categories.types"
import { and, eq, isNull, or } from "drizzle-orm"

export const getCategories = async (): Promise<Result<Category[]>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db
      .select()
      .from(categories)
      .where(
        or(eq(categories.userId, userId), isNull(categories.userId))
      )
    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)
    return err("database", "Couldn't get any categories try it later")
  }
}

export const getCategoryById = async ({
  id,
}: {
  id: number
}): Promise<Result<Category>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const [res] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.categoryId, id),
          or(eq(categories.userId, userId), isNull(categories.userId))
        )
      )
      .limit(1)

    if (!res) {
      return err("not_found", "Category not found")
    }

    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get this category, try it later")
  }
}

export const getDefaultCategory = async (
  userId: number
): Promise<Result<number>> => {
  try {
    const [category] = await db
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(
        and(
          eq(categories.name, DEFAULT_CATEGORY_NAME),
          eq(categories.userId, userId)
        )
      )
      .limit(1)

    if (category) {
      return ok(category.categoryId)
    }

    const [globalCategory] = await db
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(
        and(
          eq(categories.name, DEFAULT_CATEGORY_NAME),
          isNull(categories.userId)
        )
      )
      .limit(1)

    if (!globalCategory) {
      return err(
        "not_found",
        `Default category '${DEFAULT_CATEGORY_NAME}' not found`
      )
    }

    return ok(globalCategory.categoryId)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get the default category")
  }
}