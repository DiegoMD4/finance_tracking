import * as XLSX from "xlsx"
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
  if (v.includes(".") && v.includes(",")) {
    const lastDot = v.lastIndexOf(".")
    const lastComma = v.lastIndexOf(",")
    if (lastComma > lastDot) {
      v = v.replace(/\./g, "").replace(",", ".")
    } else {
      v = v.replace(/,/g, "")
    }
  } else if (v.includes(",") && !v.includes(".")) {
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  const dmY = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmY) {
    const [, d, m, y] = dmY
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  const yMD = v.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/)
  if (yMD) {
    const [, y, monthAbbr, d] = yMD
    const mm = MONTH_ES[monthAbbr.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, "0")}`
  }

  // Excel serial date number (e.g., 45930)
  const serial = parseFloat(v)
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const jsDate = new Date(excelEpoch.getTime() + serial * 86400000)
    const y = jsDate.getUTCFullYear()
    const m = String(jsDate.getUTCMonth() + 1).padStart(2, "0")
    const d = String(jsDate.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  return null
}

const findColumnIndex = (headers: string[], candidates: string[]): number | null => {
  const lower = headers.map((h) => String(h ?? "").toLowerCase().trim())
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand.toLowerCase()))
    if (idx !== -1) return idx
  }
  return null
}

export const parseExcel = (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[]

        if (!json || json.length < 2) {
          resolve({
            transactions: [],
            errors: ["The Excel file does not contain data rows"],
            source: "excel",
            fileName,
          })
          return
        }

        const headers = json[0] as string[]
        const rows = json.slice(1)

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
            idx === null ? "" : String(row[idx] ?? "").trim()

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
            tempId: `${fileName}-${rowNum}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
          source: "excel",
          fileName,
        })
      } catch {
        resolve({
          transactions: [],
          errors: ["Could not read the Excel file"],
          source: "excel",
          fileName,
        })
      }
    }
    reader.onerror = () => {
      resolve({
        transactions: [],
        errors: ["Error al leer el archivo de Excel"],
        source: "excel",
        fileName,
      })
    }
    reader.readAsArrayBuffer(file)
  })
}
