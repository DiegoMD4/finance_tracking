export type TransactionType = "income" | "expense"

export interface Transaction {
  id: number
  userId: number
  accountId: number
  amount: string
  transactionType: TransactionType
  transactionDescription: string | null
  categoryId: number | null
  createdAt: Date
  categoryName: string | null
  transactionDate: string | null

  transactionCurrency: string
  exchangeRate: string
  amountInDefaultCurrency: string
  defaultCurrencyAtTransaction: string
  bankReference?: string | null
}

export interface TransactionListItem extends Transaction {
  accountName: string | null
  bankName: string | null
  categoryName: string | null
  
}

export interface TransactionFormFields {
  accountId: string
  amount: string
  transactionType: string
  transactionDescription: string
  categoryId: string
  transactionCurrency: string
  bankReference?: string | null
}

export interface TransactionFormErrors {
  accountId?: string
  amount?: string
  transactionType?: string
  transactionDescription?: string
  categoryId?: string
  transactionDate?: string
  transactionCurrency?: string
  bankReference?: string
}

export interface TransactionActionResult {
  success: boolean
  message: string
  error?: TransactionFormErrors
  fields: TransactionFormFields
}

export type CreateTransaction = TransactionActionResult

export type UpdateTransaction = TransactionActionResult

export type TransactionsActionState = TransactionActionResult | null | undefined

/** Raw row payload sent by the bulk upload form, before validation. */
export interface BulkTransactionRawInput {
  tempId?: string
  row?: number
  amount: string
  transactionType: string
  transactionDescription?: string
  transactionDate: string // YYYY-MM-DD
  bankReference?: string | null
  categoryId?: string | null
}

/** Validated bulk row produced by bulkTransactionSchema on the server. */
export interface BulkTransactionInput {
  accountId: number
  amount: string
  transactionType: TransactionType
  transactionDescription: string | null
  transactionDate: Date
  bankReference: string | null
  categoryId: number
  userId: number
}

export interface BulkTransactionRowResult {
  success: boolean
  tempId: string
  row?: number
  error?: string
}

export interface BulkTransactionResult {
  success: boolean
  message: string
  saved: number
  failed: number
  rows: BulkTransactionRowResult[]
  /** tempIds que sí quedaron persistidos, para que el cliente los quite de la tabla */
  savedTempIds: string[]
}

export type BulkTransactionActionState = BulkTransactionResult | null | undefined
