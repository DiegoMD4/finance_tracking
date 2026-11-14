import { TransactionType } from "./transactions.types"

export type SuggestionConfidence = "high" | "medium" | "low"

export interface CategorySuggestionInput {
  tempId: string
  transactionDescription: string
  transactionType: TransactionType
  amount: string
}

export interface CategorySuggestion {
  tempId: string

  categoryId: string | null
  confidence: SuggestionConfidence
  reason: string | null
}

export type SuggestCategoriesResult =
  | { success: true; message: string; suggestions: CategorySuggestion[] }
  | { success: false; message: string; suggestions: [] }
