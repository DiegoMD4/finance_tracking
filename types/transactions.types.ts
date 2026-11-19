import type { DedupeSnapshot } from "@/lib/parsers/types"

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
  categoryIcon?: string | null
  categoryColor?: string | null
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
  transactionDate: string
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
  /**
   * Identidad congelada por el parser. Dato de cliente: el servidor lo
   * canonicaliza y valida antes de usarlo, nunca confía en el hash.
   */
  dedupe?: DedupeSnapshot
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

export type BulkTransactionStatus = "saved" | "duplicate" | "failed"

export interface BulkTransactionRowResult {
  success: boolean
  /** `saved` y `duplicate` son filas resueltas; `failed` es un error real. */
  status: BulkTransactionStatus
  tempId: string
  row?: number
  error?: string
}

export interface BulkTransactionResult {
  success: boolean
  message: string
  saved: number
  /** Filas omitidas por ser duplicados exactos (no son errores). */
  skipped: number
  failed: number
  rows: BulkTransactionRowResult[]
  /** tempIds que el cliente debe quitar de la tabla (guardados u omitidos) */
  savedTempIds: string[]
}

export type BulkTransactionActionState = BulkTransactionResult | null | undefined

/** Resultado del chequeo previo de duplicados por fila. */
export interface DuplicatePreviewEntry {
  /** Mismo hash y ocurrencia: ya está importada. */
  exact: boolean
  /** Misma cuenta, fecha, monto y tipo, pero sin referencia que lo confirme. */
  possible: boolean
}

export interface DuplicatePreviewResult {
  success: boolean
  message?: string
  /** Solo incluye filas con algún flag activo. */
  duplicates: Record<string, DuplicatePreviewEntry>
  exactCount: number
  possibleCount: number
}
