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
// Los helpers de monto y fecha viven ahora en `core/` para compartirlos con
// los parsers CSV/Excel. Los regex se mantienen como fallback hasta que el
// extractor posicional de PDF (Fase 3) esté disponible.
import { parseDate } from "./core/dates"
import { amountToPositiveString, parseAmount } from "./core/money"
import type { ParsedTransaction, ExtractResult } from "./types"

const normalizeDate = (raw: string): string | null => parseDate(raw)?.iso ?? null

// Formato 1: DD/MM/YYYY   Referencia   Descripción   L débito   L crédito   L balance
// Usamos matchAll global porque pdf.js no preserva saltos de línea limpios entre filas
const FORMATO_1_REGEX =
  /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\S+)\s+(.+?)\s+L\s*([\d.,]+)\s+L\s*([\d.,]+)\s+L\s*([\d.,]+)/g

// Formato 2: YYYY-Mes-DD   Referencia   Descripción   débito   crédito   balance
const FORMATO_2_REGEX =
  /(\d{4}-[A-Za-z]{3}-\d{1,2})\s+(\S+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/g

const parseMatch = (
  dateRaw: string,
  ref: string,
  desc: string,
  debitRaw: string,
  creditRaw: string
): ParsedTransaction | null => {
  const date = normalizeDate(dateRaw)
  if (!date) return null

  const debit = Math.abs(parseAmount(debitRaw).value ?? 0)
  const credit = Math.abs(parseAmount(creditRaw).value ?? 0)

  let type: "income" | "expense" = "expense"
  let amount = "0.00"

  if (credit > 0) {
    type = "income"
    amount = amountToPositiveString(credit)
  } else if (debit > 0) {
    type = "expense"
    amount = amountToPositiveString(debit)
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
    errors.push("No valid movements detected in Banco Atlántida PDF")
  }

  return {
    transactions,
    errors,
    source: "pdf",
    fileName,
  }
}
