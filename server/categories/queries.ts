import { db } from "@/db"
import { categories } from "@/db/schema/schema"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import { GetCategories, GetCategoryById } from "@/types/categories.types"
import { eq } from "drizzle-orm"

export const getCategories = async (): Promise<GetCategories> => {
  try {
    const res = await db.select().from(categories)
    return { success: true, data: res }
  } catch (error) {
    console.error("❌ Error: ", error)
    return {
      success: false,
      data: [],
      error: "Couldn't get any categories try it later",
    }
  }
}

export const getCategoryById = async ({
  id,
}: {
  id: number
}): Promise<GetCategoryById> => {
  try {
    const [res] = await db
      .select()
      .from(categories)
      .where(eq(categories.categoryId, id))
      .limit(1)

    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: undefined,
      error: "Couldn't get this category, try it later",
    }
  }
}

export const getDefaultCategory = async () => {
  try {
    const [category] = await db
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(eq(categories.name, DEFAULT_CATEGORY_NAME))
      .limit(1)

    if (!category) {
      return {
        success: false,
        categoryId: null,
        error: `Default category '${DEFAULT_CATEGORY_NAME}' not found`,
      }
    }

    return { success: true, categoryId: category.categoryId }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      categoryId: null,
      error: "Couldn't get the default category",
    }
  }
}
