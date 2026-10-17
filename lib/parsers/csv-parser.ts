import Papa from "papaparse"
import type { ParsedTransaction, ExtractResult } from "./types"

const MONTH_ES: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dic: "12",
}

const cleanAmount = (raw: string): string => {
  if (!raw) return "0"
  let v = raw.replace(/[L$€]\s*/g, "").replace(/[^\d.,-]/g, "").trim()
  // Detectar formato europeo/latam: 1.234,56 vs 1,234.56
  if (v.includes(".") && v.includes(",")) {
    // Ambos: asumimos que el último separador es decimal
    const lastDot = v.lastIndexOf(".")
    const lastComma = v.lastIndexOf(",")
    if (lastComma > lastDot) {
      // 1.234,56 -> 1234.56
      v = v.replace(/\./g, "").replace(",", ".")
    } else {
      // 1,234.56 -> 1234.56
      v = v.replace(/,/g, "")
    }
  } else if (v.includes(",") && !v.includes(".")) {
    // Podría ser 1234,56 o 1,234 (miles sin decimales)
    const parts = v.split(",")
    if (parts.length === 2 && parts[1].length === 2) {
      v = parts[0] + "." + parts[1]
    } else {
      v = v.replace(/,/g, "")
    }
  }
  const num = parseFloat(v)
  return isNaN(num) ? "0" : num.toFixed(2)
}

const normalizeDate = (raw: string): string | null => {
  if (!raw) return null
  const v = raw.trim()

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  // Formato DD/MM/YYYY
  const dmY = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmY) {
    const [, d, m, y] = dmY
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // Formato YYYY-Mes-DD (ej: 2026-Sep-07)
  const yMD = v.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/)
  if (yMD) {
    const [, y, monthAbbr, d] = yMD
    const mm = MONTH_ES[monthAbbr.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, "0")}`
  }

  return null
}

const findColumnIndex = (
  headers: string[],
  candidates: string[]
): number | null => {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand.toLowerCase()))
    if (idx !== -1) return idx
  }
  return null
}

export const parseCsv = (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const rows = result.data as Record<string, string>[]
        const headers = result.meta.fields ?? []

        const dateIdx = findColumnIndex(headers, ["fecha", "date", "fec"])
        const refIdx = findColumnIndex(headers, ["referencia", "ref", "documento", "comprobante"])
        const descIdx = findColumnIndex(headers, ["descripcion", "descripción", "detalle", "concepto", "motivo"])
        const debitIdx = findColumnIndex(headers, ["debito", "débitos", "cargo", "retiro", "egreso", "salida"])
        const creditIdx = findColumnIndex(headers, ["credito", "créditos", "abono", "deposito", "depósito", "ingreso", "entrada"])
        const amountIdx = findColumnIndex(headers, ["monto", "amount", "valor", "total"])

        const transactions: ParsedTransaction[] = []
        const errors: string[] = []

        rows.forEach((row, i) => {
          const rowNum = i + 2
          const getCol = (idx: number | null) =>
            idx === null ? "" : String(row[headers[idx]] ?? "").trim()

          const dateRaw = getCol(dateIdx)
          const refRaw = getCol(refIdx)
          const descRaw = getCol(descIdx)
          const debitRaw = getCol(debitIdx)
          const creditRaw = getCol(creditIdx)
          const amountRaw = getCol(amountIdx)

          const date = normalizeDate(dateRaw)
          if (!date) {
            errors.push(`Row ${rowNum}: invalid date ("${dateRaw}")`)
            return
          }

          let type: "income" | "expense" = "expense"
          let amount = "0"

          if (amountRaw) {
            amount = cleanAmount(amountRaw)
            type = parseFloat(amountRaw.replace(/[^\d.-]/g, "")) < 0 ? "expense" : "income"
          } else if (debitRaw || creditRaw) {
            const debit = debitRaw ? parseFloat(cleanAmount(debitRaw)) : 0
            const credit = creditRaw ? parseFloat(cleanAmount(creditRaw)) : 0
            if (credit > 0) {
              type = "income"
              amount = credit.toFixed(2)
            } else if (debit > 0) {
              type = "expense"
              amount = debit.toFixed(2)
            } else {
              type = "expense"
              amount = "0"
            }
          } else {
            errors.push(`Row ${rowNum}: no valid amount found`)
            return
          }

          const description = descRaw || "No description"
          const bankReference = refRaw || null

          if (!description && !bankReference) {
            errors.push(`Row ${rowNum}: empty row or no recognizable data`)
            return
          }

          transactions.push({
            tempId: `${fileName}-${rowNum}-${Date.now()}`,
            bankReference,
            transactionDate: date,
            transactionDescription: description,
            transactionType: type,
            amount,
            row: rowNum,
          })
        })

        resolve({
          transactions,
          errors,
          source: "csv",
          fileName,
        })
      },
      error: () => {
        resolve({
          transactions: [],
          errors: ["Could not read the CSV file"],
          source: "csv",
          fileName,
        })
      },
    })
  })
}
