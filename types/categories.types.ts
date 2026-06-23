export interface getCategoriesResponse {
  success: boolean
  message: string
  error?: string
  categories: CategoriesList[]
}

export interface CategoriesList {
  categoryId: number
  userId: number | null
  name: string | null
  icon: string | null
  color: string | null
}