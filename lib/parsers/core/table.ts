/**
 * Motor genérico de tablas.
 *
 * CSV, Excel y (más adelante) las tablas reconstruidas de un PDF se normalizan
 * a una matriz `string[][]` y pasan por este módulo. Aquí vive la detección de
 * la fila de cabecera, el mapeo de columnas por rol y la conversión a
 * `ParsedTransaction`.
 *
 * La idea es no depender de un banco concreto: se puntúan las cabeceras, se
 * valida el mapeo contra los datos reales y, si existe columna de saldo, se
 * comprueba el saldo corrido para detectar columnas invertidas.
 */

import { amountToPositiveString, parseAmount, type CurrencyCode } from "./money"
import { parseDate, resolveDayFirst } from "./dates"
import type {
  ParsedTransaction,
  ParserSource,
  TransactionType,
} from "../types"

export type Matrix = string[][]

export type ColumnRole =
  | "date"
  | "description"
  | "reference"
  | "debit"
  | "credit"
  | "amount"
  | "balance"
  | "type"

export type ColumnMapping = Record<ColumnRole, number | null>

export interface HeaderDetection {
  rowIndex: number
  score: number
  mapping: ColumnMapping
}

export interface TableParseOptions {
  fileName: string
  source: ParserSource
  /** Número de fila (1-based) de `matrix[0]` en el archivo original. Default 1. */
  firstRowNumber?: number
  dayFirst?: boolean
  currency?: CurrencyCode | null
  /** Mensaje cuando no se encuentra cabecera. */
  noHeaderMessage?: string
  /** Máximo de warnings de saldo a reportar. */
  maxBalanceWarnings?: number
}

export interface TableParseResult {
  transactions: ParsedTransaction[]
  errors: string[]
  warnings: string[]
  mapping: ColumnMapping | null
  headerRow: number | null
  dayFirst: boolean
  balanceChecked: boolean
  currency: CurrencyCode | null
}

const COLUMN_ROLES: readonly ColumnRole[] = [
  "date",
  "description",
  "reference",
  "debit",
  "credit",
  "amount",
  "balance",
  "type",
]

interface HeaderKey {
  key: string
  weight?: number
  exactOnly?: boolean
}

/**
 * Diccionario de cabeceras por rol. Incluye español, inglés y variantes
 * habituales de estados de cuenta latinoamericanos.
 */
const ROLE_KEYS: Record<ColumnRole, readonly HeaderKey[]> = {
  date: [
    { key: "fecha de transaccion", weight: 1.2 },
    { key: "fecha transaccion", weight: 1.2 },
    { key: "fecha de operacion", weight: 1.1 },
    { key: "fecha operacion", weight: 1.1 },
    { key: "fecha de posteo", weight: 1.1 },
    { key: "fecha posteo", weight: 1.1 },
    { key: "fecha valor", weight: 1 },
    { key: "fecha", weight: 1 },
    { key: "transaction date", weight: 1 },
    { key: "transactiondate", weight: 1 },
    { key: "date", weight: 1 },
    { key: "fec", weight: 0.9 },
    { key: "dia", weight: 0.6 },
  ],
  description: [
    { key: "descripcion", weight: 1.2 },
    { key: "description", weight: 1.2 },
    { key: "descripcion de la transaccion", weight: 1.2 },
    { key: "transaction description", weight: 1.2 },
    { key: "transactiondescription", weight: 1.2 },
    { key: "detalle", weight: 1.1 },
    { key: "concepto", weight: 1 },
    { key: "glosa", weight: 1 },
    { key: "memo", weight: 0.9 },
    { key: "comercio", weight: 0.9 },
    { key: "establecimiento", weight: 0.9 },
    { key: "beneficiario", weight: 0.8 },
    { key: "movimiento", weight: 0.7 },
    { key: "nombre", weight: 0.6 },
  ],
  reference: [
    { key: "referencia", weight: 1.1 },
    { key: "reference", weight: 1.1 },
    { key: "numero de documento", weight: 1 },
    { key: "numero documento", weight: 1 },
    { key: "n documento", weight: 1 },
    { key: "nro documento", weight: 1 },
    { key: "documento", weight: 0.9 },
    { key: "comprobante", weight: 0.9 },
    { key: "ref", weight: 0.9 },
    { key: "doc", weight: 0.8 },
    { key: "nro", weight: 0.7 },
    { key: "transaccion", weight: 0.5 },
  ],
  debit: [
    { key: "debitos", weight: 1.1 },
    { key: "debito", weight: 1.1 },
    { key: "cargos", weight: 1.1 },
    { key: "cargo", weight: 1.1 },
    { key: "retiros", weight: 1.1 },
    { key: "retiro", weight: 1.1 },
    { key: "egresos", weight: 1.1 },
    { key: "egreso", weight: 1.1 },
    { key: "salidas", weight: 1 },
    { key: "salida", weight: 1 },
    { key: "debit amount", weight: 1.1 },
    { key: "debit", weight: 1 },
    { key: "money out", weight: 1 },
    { key: "paid out", weight: 1 },
    { key: "withdrawal", weight: 1 },
    { key: "debe", weight: 0.9 },
    { key: "db", weight: 0.8, exactOnly: true },
    { key: "dr", weight: 0.8, exactOnly: true },
    { key: "d", weight: 0.5, exactOnly: true },
  ],
  credit: [
    { key: "creditos", weight: 1.1 },
    { key: "credito", weight: 1.1 },
    { key: "abonos", weight: 1.1 },
    { key: "abono", weight: 1.1 },
    { key: "depositos", weight: 1.1 },
    { key: "deposito", weight: 1.1 },
    { key: "ingresos", weight: 1.1 },
    { key: "ingreso", weight: 1.1 },
    { key: "entradas", weight: 1 },
    { key: "entrada", weight: 1 },
    { key: "credit amount", weight: 1.1 },
    { key: "credit", weight: 1 },
    { key: "money in", weight: 1 },
    { key: "paid in", weight: 1 },
    { key: "deposit", weight: 1 },
    { key: "haber", weight: 0.9 },
    { key: "cr", weight: 0.8, exactOnly: true },
    { key: "c", weight: 0.5, exactOnly: true },
  ],
  amount: [
    { key: "monto de la transaccion", weight: 1.2 },
    { key: "monto transaccion", weight: 1.2 },
    { key: "monto", weight: 1.1 },
    { key: "importe", weight: 1.1 },
    { key: "amount", weight: 1.1 },
    { key: "transaction amount", weight: 1.2 },
    { key: "transactionamount", weight: 1.2 },
    { key: "monto en lempiras", weight: 1.1 },
    { key: "monto hnl", weight: 1.1 },
    { key: "monto lps", weight: 1.1 },
    { key: "valor", weight: 0.9 },
    { key: "total", weight: 0.7 },
    { key: "monto usd", weight: 0.6 },
    { key: "monto en dolares", weight: 0.6 },
  ],
  balance: [
    { key: "saldo disponible", weight: 1.1 },
    { key: "saldo al cierre", weight: 1.1 },
    { key: "saldo anterior", weight: 1.1 },
    { key: "saldo", weight: 1 },
    { key: "running balance", weight: 1.1 },
    { key: "balance", weight: 1 },
  ],
  type: [
    { key: "tipo de transaccion", weight: 1.1 },
    { key: "tipo transaccion", weight: 1.1 },
    { key: "tipo", weight: 1 },
    { key: "transaction type", weight: 1.1 },
    { key: "type", weight: 1 },
    { key: "naturaleza", weight: 1 },
    { key: "debito credito", weight: 0.9 },
    { key: "debito o credito", weight: 0.9 },
    { key: "dc", weight: 0.7, exactOnly: true },
  ],
}

const ROLE_WEIGHT: Record<ColumnRole, number> = {
  date: 3,
  description: 1.5,
  reference: 0.8,
  balance: 0.8,
  amount: 3,
  debit: 3,
  credit: 3,
  type: 0.5,
}

const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/** Normaliza una celda: string, sin espacios repetidos ni extremos. */
export const normalizeCell = (value: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

/** Convierte filas heterogéneas (Excel) a una matriz de strings. */
export const toMatrix = (rows: readonly unknown[][]): Matrix =>
  rows.map((row) => (Array.isArray(row) ? row.map(normalizeCell) : []))

const normalizeHeader = (value: string): string =>
  stripAccents(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const scoreHeader = (header: string, keys: readonly HeaderKey[]): number => {
  const normalized = normalizeHeader(header)
  if (!normalized) return 0

  let best = 0
  for (const { key, weight = 1, exactOnly = false } of keys) {
    if (normalized === key) {
      best = Math.max(best, 100 * weight)
    } else if (
      !exactOnly &&
      (normalized.startsWith(`${key} `) || normalized.endsWith(` ${key}`))
    ) {
      best = Math.max(best, 70 * weight)
    } else if (!exactOnly && normalized.includes(key)) {
      best = Math.max(best, 45 * weight)
    }
  }

  return best
}

const scoreHeaders = (
  headers: readonly string[]
): Array<Partial<Record<ColumnRole, number>>> =>
  headers.map((header) => {
    const scores: Partial<Record<ColumnRole, number>> = {}
    for (const role of COLUMN_ROLES) {
      const score = scoreHeader(header, ROLE_KEYS[role])
      if (score > 0) scores[role] = score
    }
    return scores
  })

const pickBest = (
  headers: readonly string[],
  scores: Array<Partial<Record<ColumnRole, number>>>,
  role: ColumnRole,
  used: ReadonlySet<number>,
  options: { excludeBalanceLike?: boolean } = {}
): number | null => {
  let bestIndex: number | null = null
  let bestScore = 0

  for (let index = 0; index < scores.length; index += 1) {
    if (used.has(index)) continue

    const score = scores[index][role] ?? 0
    if (score <= 0) continue

    if (options.excludeBalanceLike) {
      const header = normalizeHeader(headers[index] ?? "")
      if (header.includes("saldo") || header.includes("balance")) continue
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  return bestIndex
}

const emptyMapping = (): ColumnMapping => ({
  date: null,
  description: null,
  reference: null,
  debit: null,
  credit: null,
  amount: null,
  balance: null,
  type: null,
})

const buildMapping = (
  headers: readonly string[]
): { mapping: ColumnMapping; score: number } | null => {
  const scores = scoreHeaders(headers)
  if (scores.length === 0) return null

  const mapping = emptyMapping()
  const used = new Set<number>()
  const noUsed = new Set<number>()

  // Una columna única tipo "Débito/Crédito" se puntúa para ambos roles; en ese
  // caso se interpreta como un monto firmado, no como dos columnas.
  const debitTop = pickBest(headers, scores, "debit", noUsed)
  const creditTop = pickBest(headers, scores, "credit", noUsed)
  const amountTop = pickBest(headers, scores, "amount", noUsed, {
    excludeBalanceLike: true,
  })

  if (debitTop !== null && debitTop === creditTop) {
    used.add(debitTop)
    mapping.amount = amountTop ?? debitTop
  }

  for (const role of COLUMN_ROLES) {
    if (mapping[role] !== null) continue
    const index = pickBest(headers, scores, role, used, {
      excludeBalanceLike: role === "amount",
    })
    mapping[role] = index
    if (index !== null) used.add(index)
  }

  if (mapping.date === null) return null
  if (
    mapping.amount === null &&
    mapping.debit === null &&
    mapping.credit === null
  ) {
    return null
  }

  const score = COLUMN_ROLES.reduce((total, role) => {
    const index = mapping[role]
    if (index === null) return total
    return total + (scores[index][role] ?? 0) * ROLE_WEIGHT[role]
  }, 0)

  return { mapping, score }
}

/** Mapea cabeceras a columnas. Devuelve `null` si no hay fecha o monto. */
export const mapColumns = (headers: readonly string[]): ColumnMapping | null =>
  buildMapping(headers)?.mapping ?? null

const isMostlyNumeric = (row: readonly string[]): boolean => {
  const filled = row.filter((cell) => normalizeCell(cell) !== "")
  if (filled.length === 0) return true
  return filled.every((cell) => /^[\d.,\-+()$€₡\s]+$/.test(normalizeCell(cell)))
}

const columnValues = (
  matrix: Matrix,
  column: number,
  from: number,
  limit = 6
): string[] => {
  const values: string[] = []
  for (let index = from; index < matrix.length && values.length < limit; index += 1) {
    const value = normalizeCell(matrix[index]?.[column])
    if (value) values.push(value)
  }
  return values
}

/**
 * Valida que la fila candidata sea realmente una cabecera comprobando que la
 * columna de fecha tenga datos parseables debajo.
 */
const validateCandidate = (
  matrix: Matrix,
  rowIndex: number,
  mapping: ColumnMapping
): number => {
  if (mapping.date === null) return -1

  const values = columnValues(matrix, mapping.date, rowIndex + 1)
  if (values.length === 0) return 0

  const parsed = values.filter((value) => parseDate(value) !== null).length
  if (values.length >= 2 && parsed === 0) return -1

  return values.length > 0 ? parsed / values.length : 0
}

/**
 * Encuentra la fila de cabecera con mejor puntuación.
 *
 * Se escanean las primeras `scanLimit` filas porque los bancos exportan
 * preámbulos (nombre del banco, cuenta, período, líneas vacías).
 */
export const detectHeader = (
  matrix: Matrix,
  options: { scanLimit?: number } = {}
): HeaderDetection | null => {
  const scanLimit = options.scanLimit ?? 40
  let best: HeaderDetection | null = null
  let bestScore = 0

  const limit = Math.min(matrix.length, scanLimit)
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const row = matrix[rowIndex] ?? []
    if (isMostlyNumeric(row)) continue

    const result = buildMapping(row)
    if (!result) continue

    const dateValidation = validateCandidate(matrix, rowIndex, result.mapping)
    if (dateValidation < 0) continue

    const score = result.score * (1 + dateValidation)
    if (score > bestScore) {
      bestScore = score
      best = { rowIndex, score, mapping: result.mapping }
    }
  }

  return best
}

const INCOME_LABELS = [  "credito",
  "credit",
  "abono",
  "deposito",
  "ingreso",
  "entrada",
  "haber",
  "recibido",
  "recibida",
  "c",
  "cr",
]

const EXPENSE_LABELS = [
  "debito",
  "debit",
  "cargo",
  "retiro",
  "egreso",
  "salida",
  "debe",
  "enviado",
  "enviada",
  "d",
  "db",
  "dr",
]

/**
 * Filas de resumen/pie que no son movimientos ("Saldo anterior", "Total del
 * período", ...). Se descartan sin generar error para no llenar la UI de
 * avisos por filas que el usuario nunca quiso importar.
 */
const SUMMARY_ROW_PATTERN =
  /^(?:saldo(?:\s+(?:anterior|inicial|final|actual|disponible|del|al)\b)?|sub-?total(?:es)?|gran\s+total(?:es)?|total(?:es)?|resumen(?:\s+de\s+cuenta)?)\b/

const looksLikeSummaryRow = (row: readonly string[]): boolean => {
  const firstText = row
    .map((cell) => normalizeCell(cell))
    .find((cell) => cell !== "")

  if (!firstText) return false
  return SUMMARY_ROW_PATTERN.test(stripAccents(firstText).toLowerCase())
}

/** Interpreta una columna "Tipo"/"D"/"C" cuando existe. */
export const resolveTypeFromLabel = (
  label: string
): TransactionType | null => {
  const normalized = stripAccents(label).toLowerCase().trim()
  if (!normalized) return null

  if (INCOME_LABELS.includes(normalized)) return "income"
  if (EXPENSE_LABELS.includes(normalized)) return "expense"

  if (/\bcredito\b|\bcredit\b|\babono\b|\bdeposito\b|\bingreso\b/.test(normalized)) {
    return "income"
  }
  if (/\bdebito\b|\bdebit\b|\bcargo\b|\bretiro\b|\begreso\b/.test(normalized)) {
    return "expense"
  }

  return null
}

interface BalanceRow {
  row: number
  balance: number
  /** Monto firmado: positivo para ingresos, negativo para gastos. */
  signed: number
}

/**
 * Comprueba el saldo corrido en ambos sentidos (extractos ascendentes y
 * descendentes). Un resultado sin diferencias confirma que las columnas
 * débito/crédito están bien asignadas.
 */
export const reconcileBalances = (
  rows: readonly BalanceRow[],
  maxWarnings = 5
): { checked: boolean; warnings: string[] } => {
  if (rows.length < 2) return { checked: false, warnings: [] }

  const tolerance = 0.01
  const mismatchesFor = (descending: boolean): number[] => {
    const indexes: number[] = []
    const pairs = descending ? rows.length - 1 : rows.length - 1

    for (let offset = 0; offset < pairs; offset += 1) {
      const currentIndex = descending ? offset : offset + 1
      const previousIndex = descending ? offset + 1 : offset
      const current = rows[currentIndex]
      const previous = rows[previousIndex]

      const expected = previous.balance + current.signed
      if (Math.abs(expected - current.balance) > tolerance) {
        indexes.push(currentIndex)
      }
    }

    return indexes
  }

  const ascending = mismatchesFor(false)
  const descending = mismatchesFor(true)
  const mismatches =
    descending.length < ascending.length ? descending : ascending

  if (mismatches.length === 0) {
    return { checked: true, warnings: [] }
  }

  const warnings = mismatches.slice(0, maxWarnings).map((index) => {
    const current = rows[index]
    const previous = rows[index - 1] ?? rows[index + 1]
    const expected = previous.balance + current.signed
    return `Row ${current.row}: balance mismatch (expected ${expected.toFixed(
      2
    )}, found ${current.balance.toFixed(2)})`
  })

  if (mismatches.length > maxWarnings) {
    warnings.push(
      `...and ${mismatches.length - maxWarnings} more balance mismatches`
    )
  }

  return { checked: true, warnings }
}

/**
 * Convierte una matriz tabular en transacciones.
 *
 * Reglas de monto:
 * - Si existe columna `amount`, el signo decide el tipo (salvo columna `type`).
 * - Si existen `debit`/`credit`, el que tenga valor decide el tipo.
 * - Montos en cero o ilegibles se reportan como error y no se convierten en
 *   transacciones de `0.00`.
 */
export const parseTable = (
  matrix: Matrix,
  options: TableParseOptions
): TableParseResult => {
  const firstRowNumber = options.firstRowNumber ?? 1
  const empty: TableParseResult = {
    transactions: [],
    errors: [],
    warnings: [],
    mapping: null,
    headerRow: null,
    dayFirst: options.dayFirst ?? true,
    balanceChecked: false,
    currency: options.currency ?? null,
  }

  const detection = detectHeader(matrix)
  if (!detection) {
    return {
      ...empty,
      errors: [
        options.noHeaderMessage ??
          "No se encontró una fila de cabecera válida en el archivo",
      ],
    }
  }

  const { mapping } = detection
  const headerRow = detection.rowIndex
  const dataRows = matrix.slice(headerRow + 1)

  const getCell = (row: readonly string[], index: number | null): string =>
    index === null ? "" : normalizeCell(row[index])

  // Resolver día/mes con evidencia de todo el archivo.
  const dateSamples =
    mapping.date === null
      ? []
      : columnValues(matrix, mapping.date, headerRow + 1, 200)
  const dayFirst = options.dayFirst ?? resolveDayFirst(dateSamples)

  const transactions: ParsedTransaction[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const balanceRows: BalanceRow[] = []
  let currency = options.currency ?? null
  let truncatedWarnings = 0

  dataRows.forEach((row, index) => {
    const absoluteRow = firstRowNumber + headerRow + 1 + index

    if (!row.some((cell) => normalizeCell(cell) !== "")) return

    const dateRaw = getCell(row, mapping.date)
    const parsedDate = parseDate(dateRaw, { dayFirst })
    if (!parsedDate) {
      // "Saldo anterior", "Total", "Resumen": no son movimientos, se omiten
      // en silencio en lugar de reportar una fecha inválida.
      if (looksLikeSummaryRow(row)) return

      errors.push(`Row ${absoluteRow}: invalid date ("${dateRaw}")`)
      return
    }

    const amountRaw = getCell(row, mapping.amount)
    const debitRaw = getCell(row, mapping.debit)
    const creditRaw = getCell(row, mapping.credit)
    const typeRaw = getCell(row, mapping.type)

    let amountValue: number | null = null
    let transactionType: TransactionType | null = null

    if (amountRaw) {
      const parsed = parseAmount(amountRaw, { currency })
      if (parsed.value === null) {
        errors.push(`Row ${absoluteRow}: no valid amount found`)
        return
      }
      if (parsed.value === 0) {
        errors.push(`Row ${absoluteRow}: amount is zero`)
        return
      }

      amountValue = Math.abs(parsed.value)
      transactionType =
        resolveTypeFromLabel(typeRaw) ??
        (parsed.value < 0 ? "expense" : "income")
      currency = currency ?? parsed.currency
    } else if (debitRaw || creditRaw) {
      const debit = Math.abs(parseAmount(debitRaw, { currency }).value ?? 0)
      const credit = Math.abs(parseAmount(creditRaw, { currency }).value ?? 0)

      if (credit > 0) {
        transactionType = "income"
        amountValue = credit
      } else if (debit > 0) {
        transactionType = "expense"
        amountValue = debit
      } else {
        errors.push(`Row ${absoluteRow}: no valid amount found`)
        return
      }
    } else {
      errors.push(`Row ${absoluteRow}: no valid amount found`)
      return
    }

    let description = getCell(row, mapping.description) || "No description"
    if (description.length > 255) {
      description = description.slice(0, 255)
      truncatedWarnings += 1
    }

    const reference = getCell(row, mapping.reference) || null
    const finalType: TransactionType = transactionType ?? "expense"

    transactions.push({
      tempId: `${options.fileName}-${absoluteRow}-${transactions.length}`,
      bankReference: reference,
      transactionDate: parsedDate.iso,
      transactionDescription: description,
      transactionType: finalType,
      amount: amountToPositiveString(amountValue),
      row: absoluteRow,
    })

    const balance = parseAmount(getCell(row, mapping.balance)).value
    if (balance !== null) {
      balanceRows.push({
        row: absoluteRow,
        balance,
        signed: finalType === "income" ? (amountValue ?? 0) : -(amountValue ?? 0),
      })
    }
  })

  if (truncatedWarnings > 0) {
    warnings.push(
      `${truncatedWarnings} description${
        truncatedWarnings === 1 ? " was" : "s were"
      } truncated to 255 characters`
    )
  }

  const reconciliation = reconcileBalances(
    balanceRows,
    options.maxBalanceWarnings ?? 5
  )
  warnings.push(...reconciliation.warnings)

  return {
    transactions,
    errors,
    warnings,
    mapping,
    headerRow: headerRow + 1,
    dayFirst,
    balanceChecked: reconciliation.checked,
    currency: currency ?? null,
  }
}

/** Convierte un mapeo de columnas en un objeto plano rol -> índice. */
export const mappingToColumnIndexes = (
  mapping: ColumnMapping | null
): Record<string, number> => {
  if (!mapping) return {}

  const columns: Record<string, number> = {}
  for (const role of COLUMN_ROLES) {
    const index = mapping[role]
    if (index !== null) columns[role] = index
  }
  return columns
}
