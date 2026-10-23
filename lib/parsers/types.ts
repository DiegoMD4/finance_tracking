export type TransactionType = "income" | "expense"

export interface ParsedTransaction {
  tempId: string
  bankReference: string | null
  transactionDate: string // YYYY-MM-DD
  transactionDescription: string
  transactionType: TransactionType
  amount: string
  categoryId?: string | null
  row?: number
}

export interface ExtractResult {
  transactions: ParsedTransaction[]
  errors: string[]
  source: "csv" | "excel" | "pdf" | "unknown"
  fileName: string
  rawText?: string
}

export type ParserSource = "csv" | "excel" | "pdf" | "unknown"
