import type { ExtractResult, ParsedTransaction } from "./types"
import { parseCsv } from "./csv-parser"
import { parseExcel } from "./excel-parser"
import { parseAtlántidaPDF } from "./atlantida-pdf-parser"

export const getFileSource = (fileName: string): "csv" | "excel" | "pdf" | "unknown" => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".csv")) return "csv"
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel"
  if (lower.endsWith(".pdf")) return "pdf"
  return "unknown"
}

export const extractTransactions = async (
  file: File
): Promise<ExtractResult> => {
  const source = getFileSource(file.name)
  const fileName = file.name

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
 * Extrae texto del PDF en el cliente usando pdfjs-dist y luego aplica el parser de Atlántida.
 */
const extractPdfTransactions = async (
  file: File,
  fileName: string
): Promise<ExtractResult> => {
  // Import dinámico para evitar problemas de SSR con pdfjs-dist
  const pdfjsLib = await import("pdfjs-dist")
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs")

  if (pdfjsLib.GlobalWorkerOptions.workerSrc === undefined) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = (worker as any).default || worker
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => (item as any).str ?? "")
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
    }
  }

  const result = parseAtlántidaPDF(fullText, fileName)
  return {
    ...result,
    rawText: fullText,
  }
}
