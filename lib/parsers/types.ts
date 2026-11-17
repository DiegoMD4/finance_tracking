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
  /** Fila original (texto de cada celda) para auditoría/debug. */
  rawRow?: string[]
}

/**
 * Metadatos de la detección de formato/columnas. Se agrega de forma opcional
 * para no romper a los consumidores existentes de `ExtractResult`.
 */
export interface DetectionInfo {
  format: "csv" | "excel" | "pdf" | "unknown"
  /** Banco detectado por firma de texto (null si no se pudo determinar). */
  bank: string | null
  /** Moneda inferida a partir de los montos. */
  currency: string | null
  /** Confianza global de la detección, de 0 a 1. */
  confidence: number
  /** Fila (1-based) donde se encontró la cabecera. */
  headerRow: number | null
  /** Delimitador detectado en archivos CSV. */
  delimiter: string | null
  /** Encoding detectado en archivos de texto. */
  encoding: string | null
  /** Hojas del libro leídas (solo Excel). */
  sheetName: string | null
  /** Columnas mapeadas: rol -> índice de columna. */
  columns: Record<string, number>
  /** `true` cuando se pudo validar el saldo corrido. */
  balanceChecked: boolean
}

export interface ExtractResult {
  transactions: ParsedTransaction[]
  errors: string[]
  /** Avisos que no impiden guardar las transacciones. */
  warnings?: string[]
  source: "csv" | "excel" | "pdf" | "unknown"
  fileName: string
  rawText?: string
  detection?: DetectionInfo
}

export type ParserSource = "csv" | "excel" | "pdf" | "unknown"
