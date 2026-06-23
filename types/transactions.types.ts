export type TransactionType = "income" | "expense"

export interface Transaction {
  id: number
  userId: number
  accountId: number
  amount: string
  transactionType: TransactionType
  transactionDescription: string | null
  categoryId: number | null,
  createdAt: Date
  categoryName: string | null
}

export interface TransactionListItem extends Transaction {
  accountName: string | null
  bankName: string | null
  categoryName: string | null
}

export interface GetTransactions {
  success: boolean
  error?: string
  data: TransactionListItem[]
  hasMore?: boolean
}

export interface GetTransactionById {
  success: boolean
  error?: string
  data?: Transaction
}

export interface TransactionFormFields {
  userId: string
  accountId: string
  amount: string
  transactionType: string
  transactionDescription: string
  categoryId: string,
}

export interface TransactionFormErrors {
  userId?: string
  accountId?: string
  amount?: string
  transactionType?: string
  transactionDescription?: string
  categoryId?: string
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
