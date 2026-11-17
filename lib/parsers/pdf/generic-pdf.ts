/**
 * Parser genérico de PDF basado en posiciones.
 *
 * Flujo:
 *   1. `buildPdfRows` reconstruye filas y celdas con X/Y (ver `layout.ts`).
 *   2. Se busca la fila de cabecera con el mismo mapeo que usa CSV/Excel.
 *   3. Cada celda de datos se asigna a una columna por su anclaje horizontal:
 *      los textos se anclan por la izquierda y los números por la derecha.
 *   4. La matriz resultante entra en `parseTable`, así que hereda validación
 *      de fechas, montos, tipos, saldo y warnings.
 *
 * Si no se reconoce una cabecera se devuelve `null` y el llamador cae al
 * fallback por regex (`atlantida-pdf-parser.ts`).
 */

import { parseDate } from "../core/dates"
import { detectCurrencyFromText } from "../core/detection"
import {
  mapColumns,
  mappingToColumnIndexes,
  parseTable,
  type ColumnMapping,
  type Matrix,
} from "../core/table"
import {
  buildPdfRows,
  pdfRowsToText,
  type PdfCell,
  type PdfRow,
} from "./layout"
import type { ExtractResult } from "../types"

export interface PdfLayoutParseOptions {
  fileName: string
  /** Banco detectado por firma de texto, solo informativo. */
  bank?: string | null
  /** Límite de filas para evitar documentos gigantes (default 5000). */
  maxRows?: number
  /** Filas a escanear buscando la cabecera (default 80). */
  headerScanLimit?: number
}

interface HeaderMatch {
  rowIndex: number
  cells: PdfCell[]
  mapping: ColumnMapping
}

const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const normalizeText = (value: string): string =>
  stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim()

/**
 * Heurística de alineación: si la celda tiene muchos dígitos y pocas letras
 * (montos con o sin símbolo de moneda) se asume alineada a la derecha.
 */
const looksNumeric = (text: string): boolean => {
  const digits = text.match(/\d/g)?.length ?? 0
  const letters = text.match(/[a-záéíóúñ]/gi)?.length ?? 0
  return digits > 0 && letters <= 3
}

const anchorFor = (cell: PdfCell, numeric: boolean): number =>
  numeric ? cell.xEnd : cell.x

/** Asigna una celda a la columna de cabecera más cercana según su anclaje. */
const assignColumn = (headerCells: readonly PdfCell[], cell: PdfCell): number => {
  const numeric = looksNumeric(cell.text)
  const anchor = anchorFor(cell, numeric)

  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  headerCells.forEach((header, index) => {
    const distance = Math.abs(anchor - anchorFor(header, numeric))
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
}

const assignRow = (
  cells: readonly PdfCell[],
  headerCells: readonly PdfCell[]
): string[] => {
  const row = new Array<string>(headerCells.length).fill("")

  for (const cell of cells) {
    const column = assignColumn(headerCells, cell)
    row[column] = row[column] ? `${row[column]} ${cell.text}` : cell.text
  }

  return row
}

/**
 * Busca la fila de cabecera. Se exige que al menos una fila posterior tenga
 * una fecha parseable en la columna de fecha, para no confundir un título con
 * una cabecera.
 */
const findHeader = (
  rows: readonly PdfRow[],
  scanLimit: number
): HeaderMatch | null => {
  const limit = Math.min(rows.length, scanLimit)

  for (let index = 0; index < limit; index += 1) {
    const cells = rows[index].cells
    if (cells.length < 3) continue

    const mapping = mapColumns(cells.map((cell) => cell.text))
    if (!mapping || mapping.date === null) continue

    const dateColumn = mapping.date
    const hasDateBelow = rows.slice(index + 1, index + 12).some((row) => {
      const matrixRow = assignRow(row.cells, cells)
      const value = matrixRow[dateColumn]
      return Boolean(value) && parseDate(value) !== null
    })

    if (hasDateBelow) return { rowIndex: index, cells, mapping }
  }

  return null
}

/**
 * Convierte filas ya reconstruidas en transacciones.
 * Devuelve `null` si no hay cabecera reconocible o ninguna transacción.
 */
export const parsePdfRows = (
  rows: readonly PdfRow[],
  options: PdfLayoutParseOptions
): ExtractResult | null => {
  if (rows.length === 0) return null

  const maxRows = options.maxRows ?? 5000
  const header = findHeader(rows, options.headerScanLimit ?? 80)
  if (!header) return null

  const { cells: headerCells, mapping, rowIndex: headerIndex } = header
  const headerTexts = headerCells.map((cell) => cell.text)
  const headerSignature = headerTexts.map(normalizeText).join("|")

  const matrix: Matrix = [headerTexts]
  const dateColumn = mapping.date
  const descriptionColumn = mapping.description

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    if (matrix.length > maxRows) break

    const row = rows[index]
    if (row.cells.length === 0) continue

    const signature = row.cells.map((cell) => normalizeText(cell.text)).join("|")
    if (signature === headerSignature) continue

    const values = assignRow(row.cells, headerCells)
    if (values.every((value) => !value)) continue

    const dateValue = dateColumn === null ? "" : values[dateColumn] ?? ""

    if (!dateValue || parseDate(dateValue) === null) {
      // Posible continuación de una descripción partida en dos renglones.
      const filled = values
        .map((value, column) => ({ value, column }))
        .filter((entry) => entry.value)

      if (
        descriptionColumn !== null &&
        filled.length === 1 &&
        filled[0].column === descriptionColumn &&
        matrix.length > 1
      ) {
        const previous = matrix[matrix.length - 1]
        previous[descriptionColumn] =
          `${previous[descriptionColumn]} ${filled[0].value}`.trim()
      }

      // Cabeceras de página, pies, totales y resúmenes se descartan.
      continue
    }

    matrix.push(values)
  }

  if (matrix.length <= 1) return null

  const table = parseTable(matrix, {
    fileName: options.fileName,
    source: "pdf",
    firstRowNumber: 1,
  })

  if (table.transactions.length === 0) return null

  const rawText = pdfRowsToText(rows)

  return {
    transactions: table.transactions,
    errors: table.errors,
    warnings: table.warnings,
    source: "pdf",
    fileName: options.fileName,
    rawText,
    detection: {
      format: "pdf",
      bank: options.bank ?? null,
      currency: table.currency ?? detectCurrencyFromText(rawText),
      confidence: table.mapping ? 0.85 : 0,
      headerRow: table.headerRow,
      delimiter: null,
      encoding: null,
      sheetName: null,
      columns: mappingToColumnIndexes(table.mapping),
      balanceChecked: table.balanceChecked,
    },
  }
}

/**
 * Recibe los `TextItem` de cada página (tal como los entrega pdf.js) y
 * devuelve el resultado o `null` si el PDF no tiene una tabla reconocible.
 */
export const parsePdfPages = (
  pages: readonly (readonly unknown[])[],
  options: PdfLayoutParseOptions
): ExtractResult | null => {
  const rows = pages.flatMap((items) => buildPdfRows(items))
  return parsePdfRows(rows, options)
}
