import Papa from "papaparse"

import { parseDate } from "./core/dates"
import { formatAmount, parseAmount } from "./core/money"
import {
  detectBank,
  detectCurrencyFromText,
} from "./core/detection"
import { decodeBytes, stripSepLine } from "./core/text"
import {
  mappingToColumnIndexes,
  normalizeCell,
  parseTable,
  type Matrix,
} from "./core/table"
import type { ExtractResult } from "./types"

/**
 * Compatibilidad: la versión anterior devolvía siempre un string.
 * `""`/texto sin dígitos se sigue mostrando como `"0"`, pero internamente el
 * motor usa `parseAmount`, que distingue "sin monto" de "cero".
 */
export const cleanAmount = (raw: string): string =>
  formatAmount(parseAmount(raw).value)

/** Compatibilidad: fecha en `YYYY-MM-DD` o `null`. */
export const normalizeDate = (raw: string): string | null =>
  parseDate(raw)?.iso ?? null

export const parseCsv = async (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  let rawText = ""

  try {
    const buffer = await file.arrayBuffer()
    const decoded = decodeBytes(buffer)
    const stripped = stripSepLine(decoded.text)
    rawText = stripped.text

    const parsed = await new Promise<Papa.ParseResult<string[]>>(
      (resolve, reject) => {
        Papa.parse<string[]>(stripped.text, {
          header: false,
          // No se omiten líneas vacías: así el índice de la matriz coincide con
          // la línea real del archivo y la numeración de fila es absoluta.
          skipEmptyLines: false,
          delimiter: stripped.delimiter ?? "",
          complete: (result) => resolve(result),
          error: (error: Error) => reject(error),
        })
      }
    )

    const matrix: Matrix = parsed.data.map((row) =>
      Array.isArray(row) ? row.map(normalizeCell) : [normalizeCell(row)]
    )

    const table = parseTable(matrix, {
      fileName,
      source: "csv",
      noHeaderMessage:
        "No se encontró una fila de cabecera válida en el archivo CSV",
    })

    const parserWarnings = parsed.errors.map((error) => {
      const row = typeof error.row === "number" ? ` ${error.row + 1}` : ""
      return `CSV row${row}: ${error.message}`
    })

    const bank = detectBank(rawText)
    const delimiter = stripped.delimiter ?? parsed.meta.delimiter ?? null

    return {
      transactions: table.transactions,
      errors: table.errors,
      warnings: [...parserWarnings, ...table.warnings],
      source: "csv",
      fileName,
      rawText,
      detection: {
        format: "csv",
        bank,
        currency: table.currency ?? detectCurrencyFromText(rawText),
        confidence: table.mapping ? (bank ? 0.95 : 0.9) : 0,
        headerRow: table.headerRow,
        delimiter,
        encoding: decoded.encoding,
        sheetName: null,
        columns: mappingToColumnIndexes(table.mapping),
        balanceChecked: table.balanceChecked,
      },
    }
  } catch {
    return {
      transactions: [],
      errors: ["Could not read the CSV file"],
      source: "csv",
      fileName,
      rawText,
    }
  }
}
