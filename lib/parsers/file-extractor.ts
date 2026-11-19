import type {
  DetectionInfo,
  ExtractResult,
  ParserSource,
  ParsedTransaction,
} from "./types"
import { parseCsv } from "./csv-parser"
import { parseExcel } from "./excel-parser"
import { parseAtlántidaPDF } from "./atlantida-pdf-parser"
import {
  detectBank,
  detectCurrencyFromText,
  resolveFileFormat,
} from "./core/detection"
import { parsePdfPages } from "./pdf/generic-pdf"
import { assignOccurrences } from "@/lib/transactions/dedupe"

/**
 * Detección por extensión. Se mantiene como respaldo cuando el contenido no
 * es reconocible (por ejemplo, un archivo vacío).
 */
export const getFileSource = (
  fileName: string
): "csv" | "excel" | "pdf" | "unknown" => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".csv")) return "csv"
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel"
  if (lower.endsWith(".pdf")) return "pdf"
  return "unknown"
}

export interface ExtractOptions {
  /**
   * Moneda vigente en el formulario. Solo se usa si el archivo no declara una;
   * en cualquier caso queda congelada en el snapshot de cada fila.
   */
  currency?: string | null
}

/**
 * Congela la identidad de cada fila al terminar el parseo: snapshot original
 * + ocurrencia (1..n) calculada sobre **todas** las filas del archivo.
 *
 * Se hace acá porque es el embudo de los tres formatos: los parsers quedan
 * sin conocer el dedupe y sus tests no cambian.
 */
const withDedupeSnapshots = (
  result: ExtractResult,
  fallbackCurrency: string | null
): ExtractResult => {
  if (result.transactions.length === 0) return result

  const currency = result.detection?.currency ?? fallbackCurrency ?? null
  const candidates = result.transactions.map((tx) => ({
    currency,
    original: {
      date: tx.transactionDate,
      amount: tx.amount,
      type: tx.transactionType,
      reference: tx.bankReference ?? null,
      description: tx.transactionDescription ?? "",
      currency,
    },
  }))

  const occurrences = assignOccurrences(candidates)

  return {
    ...result,
    transactions: result.transactions.map(
      (tx, index): ParsedTransaction => ({
        ...tx,
        dedupe: {
          original: candidates[index].original,
          occurrence: occurrences[index],
        },
      })
    ),
  }
}

export const extractTransactions = async (
  file: File,
  options: ExtractOptions = {}
): Promise<ExtractResult> => {
  const result = await extractRaw(file)
  return withDedupeSnapshots(result, options.currency ?? null)
}

const extractRaw = async (file: File): Promise<ExtractResult> => {
  const fileName = file.name
  let source: ParserSource = getFileSource(fileName)

  // El contenido manda sobre la extensión: detecta PDF, XLSX/ZIP, OLE (.xls
  // antiguo) y texto (CSV/tabulado) aunque el nombre del archivo mienta.
  try {
    const buffer = await file.arrayBuffer()
    source = resolveFileFormat(fileName, buffer)
  } catch {
    // Si no se puede leer el buffer, seguimos con la extensión.
  }

  if (source === "unknown") {
    return {
      transactions: [],
      errors: [
        `Incompatible file format: "${fileName}". Use .csv, .xlsx, .xls or .pdf`,
      ],
      source: "unknown",
      fileName,
    }
  }

  try {
    if (source === "csv") {
      return await parseCsv(file, fileName)
    }

    if (source === "excel") {
      return await parseExcel(file, fileName)
    }

    if (source === "pdf") {
      return await extractPdfTransactions(file, fileName)
    }
  } catch (error) {
    return {
      transactions: [],
      errors: [
        `Unexpected error processing "${fileName}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      source,
      fileName,
    }
  }

  return {
    transactions: [],
    errors: ["Unsupported file format"],
    source: "unknown",
    fileName,
  }
}

/**
 * Extrae transacciones de un PDF en el cliente usando pdfjs-dist.
 *
 * Estrategia:
 *   1. Se recolectan los `TextItem` de cada página (con su X/Y) y se intenta
 *      la reconstrucción posicional (`parsePdfPages`), que reutiliza el motor
 *      genérico de tablas.
 *   2. Si el PDF no tiene una tabla reconocible, se cae al parser por regex
 *      de Atlántida sobre el texto plano.
 */
const extractPdfTransactions = async (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  // Import dinámico para evitar problemas de SSR con pdfjs-dist
  const pdfjsLib = await import("pdfjs-dist")
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs")

  if (pdfjsLib.GlobalWorkerOptions.workerSrc === undefined) {
    const workerDefault = (worker as { default?: unknown }).default
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      typeof workerDefault === "string" ? workerDefault : String(worker)
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ""
  const pages: unknown[][] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items: unknown[] = [...content.items]
    pages.push(items)

    const pageText = items
      .map((item) => (item as { str?: string }).str ?? "")
      .join(" ")
    fullText += pageText + "\n"
  }

  if (!fullText.trim()) {
    return {
      transactions: [],
      errors: [
        "The PDF does not contain readable text. It may be a scanned or protected document.",
      ],
      source: "pdf",
      fileName,
      rawText: "",
      warnings: [],
      detection: {
        format: "pdf",
        bank: null,
        currency: null,
        confidence: 0,
        headerRow: null,
        delimiter: null,
        encoding: null,
        sheetName: null,
        columns: {},
        balanceChecked: false,
      },
    }
  }

  const bank = detectBank(fullText)

  // 1) Reconstrucción posicional: si el PDF tiene una tabla con cabecera
  // reconocible, se parsea con el motor genérico.
  const layout = parsePdfPages(pages, { fileName, bank })
  if (layout) return layout

  // 2) Fallback: regex sobre el texto plano (formatos ya conocidos).
  const result = parseAtlántidaPDF(fullText, fileName)
  const detection: DetectionInfo = {
    format: "pdf",
    bank,
    currency: detectCurrencyFromText(fullText),
    confidence: result.transactions.length > 0 ? 0.7 : 0,
    headerRow: null,
    delimiter: null,
    encoding: null,
    sheetName: null,
    columns: {},
    balanceChecked: false,
  }

  return {
    ...result,
    rawText: fullText,
    warnings: result.warnings ?? [],
    detection,
  }
}
