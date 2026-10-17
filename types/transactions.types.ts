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
