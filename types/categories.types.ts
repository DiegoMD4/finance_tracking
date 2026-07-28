export interface Category {
  categoryId: number
  userId: number | null
  name: string
  icon: string | null
  color: string | null
}

export interface GetCategories {
  success: boolean
  error?: string
  data: Category[]
}

export interface GetCategoryById {
  success: boolean
  error?: string
  data?: Category
}

export interface CategoryFormFields {
  name: string
  icon: string
  color: string
}

export interface CategoryFormErrors {
  name?: string
  icon?: string
  color?: string
}

export interface CategoryActionResult {
  success: boolean
  message: string
  error?: CategoryFormErrors
  fields: CategoryFormFields
}

export type CreateCategory = CategoryActionResult

export type UpdateCategory = CategoryActionResult

export type CategoriesActionState = CategoryActionResult | null | undefined
