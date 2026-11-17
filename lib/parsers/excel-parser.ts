import {
  detectBank,
  detectCurrencyFromText,
} from "./core/detection"
import {
  detectHeader,
  mappingToColumnIndexes,
  parseTable,
  toMatrix,
  type Matrix,
} from "./core/table"
import type { ExtractResult } from "./types"

interface SheetCandidate {
  sheetName: string
  matrix: Matrix
  score: number
}

/**
 * Lee todas las hojas del libro y elige la que mejor puntúa como tabla de
 * movimientos. Algunos bancos exportan el estado de cuenta en la segunda hoja
 * o incluyen una hoja de resumen antes.
 */
export const parseExcel = async (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    // Import dinámico: `xlsx` es pesado y solo se carga cuando el usuario sube
    // un Excel, no en el bundle inicial del formulario.
    const XLSX = await import("xlsx")
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    let best: SheetCandidate | null = null

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) continue

      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: true,
        // Mantener las filas vacías para que los índices coincidan con la hoja
        // real; `parseTable` las ignora pero la numeración queda alineada.
        blankrows: true,
      })
      const matrix = toMatrix(rows as unknown[][])
      if (matrix.length === 0) continue

      const detection = detectHeader(matrix)
      if (!detection) continue

      if (!best || detection.score > best.score) {
        best = { sheetName, matrix, score: detection.score }
      }
    }

    if (!best) {
      return {
        transactions: [],
        errors: ["No se encontró la fila de cabecera en el archivo Excel"],
        source: "excel",
        fileName,
        rawText: "",
      }
    }

    const table = parseTable(best.matrix, {
      fileName,
      source: "excel",
      noHeaderMessage:
        "No se encontró la fila de cabecera en el archivo Excel",
    })

    const rawText = best.matrix.map((row) => row.join("\t")).join("\n")
    const bank = detectBank(rawText)

    return {
      transactions: table.transactions,
      errors: table.errors,
      warnings: table.warnings,
      source: "excel",
      fileName,
      rawText,
      detection: {
        format: "excel",
        bank,
        currency: table.currency ?? detectCurrencyFromText(rawText),
        confidence: table.mapping ? (bank ? 0.95 : 0.9) : 0,
        headerRow: table.headerRow,
        delimiter: null,
        encoding: null,
        sheetName: best.sheetName,
        columns: mappingToColumnIndexes(table.mapping),
        balanceChecked: table.balanceChecked,
      },
    }
  } catch {
    return {
      transactions: [],
      errors: ["Could not read the Excel file"],
      source: "excel",
      fileName,
      rawText: "",
    }
  }
}
