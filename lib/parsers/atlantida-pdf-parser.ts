// Atlántida PDF parser
//
// Soporta dos formatos de estado de cuenta de Banco Atlántida:
//
// Formato 1 - Reporte de Movimientos en Línea / App Digital
//   Columnas: Fecha | Referencia | Descripción | Débito | Crédito | Balance
//   Fecha: DD/MM/YYYY
//   Montos con prefijo "L" (ej: L 3,300.00)
//
// Formato 2 - Estado de Cuenta Mensual Oficial (Core SAP)
//   Columnas: Fecha | Referencia | Descripción | Débitos | Créditos | Saldo
//   Fecha: YYYY-Mes-DD (ej: 2026-Sep-07)
//   Montos numéricos sin prefijo "L"
//
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

  return null
}

const isSummaryLine = (line: string): boolean => {
  const l = line.toLowerCase()
  return (
    l.includes("saldo anterior") ||
    l.includes("créditos (+)") ||
    l.includes("débitos (-)") ||
    l.includes("saldo al cierre") ||
    l.includes("saldo disponible") ||
    l.includes("total créditos") ||
    l.includes("total débitos") ||
    l.includes("página") ||
    l.includes("www.bancatlan") ||
    l.includes("contactanos")
  )
}

// Formato 1: DD/MM/YYYY   Referencia   Descripción   L débito   L crédito   L balance
// Usamos matchAll global porque pdf.js no preserva saltos de línea limpios entre filas
const FORMATO_1_REGEX = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\S+)\s+(.+?)\s+L\s*([\d.,]+)\s+L\s*([\d.,]+)\s+L\s*([\d.,]+)/g

// Formato 2: YYYY-Mes-DD   Referencia   Descripción   débito   crédito   balance
const FORMATO_2_REGEX = /(\d{4}-[A-Za-z]{3}-\d{1,2})\s+(\S+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/g

const parseMatch = (
  dateRaw: string,
  ref: string,
  desc: string,
  debitRaw: string,
  creditRaw: string
): ParsedTransaction | null => {
  const date = normalizeDate(dateRaw)
  if (!date) return null

  const debit = parseFloat(cleanAmount(debitRaw))
  const credit = parseFloat(cleanAmount(creditRaw))

  let type: "income" | "expense" = "expense"
  let amount = "0"

  if (credit > 0) {
    type = "income"
    amount = credit.toFixed(2)
  } else if (debit > 0) {
    type = "expense"
    amount = debit.toFixed(2)
  } else {
    return null
  }

  return {
    tempId: `${date}-${desc.slice(0, 20)}-${Math.random().toString(36).slice(2)}`,
    bankReference: ref || null,
    transactionDate: date,
    transactionDescription: desc.trim() || "No description",
    transactionType: type,
    amount,
  }
}

export const parseAtlántidaPDF = (
  text: string,
  fileName: string
): ExtractResult => {
  const transactions: ParsedTransaction[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  // Formato 1: fechas DD/MM/YYYY con montos "L"
  for (const match of text.matchAll(FORMATO_1_REGEX)) {
    const [, dateRaw, ref, desc, debitRaw, creditRaw] = match
    const key = `${dateRaw}-${ref}-${debitRaw}-${creditRaw}`
    if (seen.has(key)) continue
    seen.add(key)

    const parsed = parseMatch(dateRaw, ref, desc, debitRaw, creditRaw)
    if (parsed) {
      transactions.push({
        ...parsed,
        tempId: `${fileName}-f1-${parsed.tempId}`,
        row: transactions.length + 1,
      })
    }
  }

  // Formato 2: fechas YYYY-Mes-DD con montos numéricos
  for (const match of text.matchAll(FORMATO_2_REGEX)) {
    const [, dateRaw, ref, desc, debitRaw, creditRaw] = match
    const key = `${dateRaw}-${ref}-${debitRaw}-${creditRaw}`
    if (seen.has(key)) continue
    seen.add(key)

    const parsed = parseMatch(dateRaw, ref, desc, debitRaw, creditRaw)
    if (parsed) {
      transactions.push({
        ...parsed,
        tempId: `${fileName}-f2-${parsed.tempId}`,
        row: transactions.length + 1,
      })
    }
  }

  if (transactions.length === 0) {
    errors.push(
      "No valid movements detected in Banco Atlántida PDF"
    )
  }

  return {
    transactions,
    errors,
    source: "pdf",
    fileName,
  }
}
