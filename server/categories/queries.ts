import { db } from "@/db"
import { categories } from "@/db/schema/schema"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import { err, ok, type Result } from "@/types/result"
import type { Category } from "@/types/categories.types"
import { eq } from "drizzle-orm"

export const getCategories = async (): Promise<Result<Category[]>> => {
  try {
    const res = await db.select().from(categories)
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
  try {
    const [res] = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, id))
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

export const getDefaultCategory = async (): Promise<Result<number>> => {
  try {
    const [category] = await db
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(eq(categories.name, DEFAULT_CATEGORY_NAME))
      .limit(1)

    if (!category) {
      return err(
        "not_found",
        `Default category '${DEFAULT_CATEGORY_NAME}' not found`
      )
    }

    return ok(category.categoryId)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get the default category")
  }
}