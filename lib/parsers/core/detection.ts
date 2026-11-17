/**
 * Detección de formato y banco.
 *
 * Dos niveles:
 * 1. `sniffFormatFromBytes`: mira las firmas del archivo (PDF, ZIP/XLSX, OLE,
 *    HTML disfrazado de .xls) y cae a heurística de texto. Sirve para archivos
 *    con extensión incorrecta o sin extensión.
 * 2. `detectBank` / `detectCurrencyFromText`: reconocen el banco y la moneda
 *    por firmas de texto en el contenido. La detección es solo informativa:
 *    los parsers nunca dependen de saber el banco para mapear columnas.
 */

import type { CurrencyCode } from "./money"
import { looksLikeText } from "./text"

export type FileFormat = "csv" | "excel" | "pdf" | "unknown"

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] // %PDF
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // PK\x03\x04
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

const startsWithBytes = (buffer: ArrayBuffer, bytes: readonly number[]): boolean => {
  if (buffer.byteLength < bytes.length) return false
  const view = new Uint8Array(buffer, 0, bytes.length)
  return bytes.every((byte, index) => view[index] === byte)
}

const asciiHead = (buffer: ArrayBuffer, limit = 2048): string => {
  const length = Math.min(buffer.byteLength, limit)
  const bytes = new Uint8Array(buffer, 0, length)
  let out = ""
  for (const byte of bytes) {
    out += byte < 0x80 ? String.fromCharCode(byte) : " "
  }
  return out.toLowerCase()
}

/**
 * Detecta el formato real mirando el contenido, no la extensión.
 * Los archivos de texto se tratan como `csv`: el motor de tablas elige el
 * delimitador (coma, punto y coma, tabulación o pipe).
 */
export const sniffFormatFromBytes = (buffer: ArrayBuffer): FileFormat => {
  if (buffer.byteLength === 0) return "unknown"
  if (startsWithBytes(buffer, PDF_SIGNATURE)) return "pdf"
  if (startsWithBytes(buffer, ZIP_SIGNATURE)) return "excel"
  if (startsWithBytes(buffer, OLE_SIGNATURE)) return "excel"

  if (looksLikeText(buffer)) {
    const head = asciiHead(buffer)
    // Algunos bancos exportan HTML con extensión .xls.
    if (head.includes("<html") || head.includes("<table") || head.includes("<tr")) {
      return "excel"
    }
    return "csv"
  }

  return "unknown"
}

const extensionFormat = (fileName: string): FileFormat => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    return "excel"
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) {
    return "csv"
  }
  return "unknown"
}

/**
 * Extensiones que nunca deben interpretarse como texto, aunque su contenido
 * sea legible por casualidad (el test de formato desconocido usa un PNG con
 * texto adentro, por ejemplo).
 */
const UNSUPPORTED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".svg",
  ".ico",
  ".zip",
  ".rar",
  ".7z",
  ".gz",
  ".tar",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".exe",
  ".dmg",
  ".apk",
  ".json",
  ".xml",
  ".html",
  ".htm",
]

const isUnsupportedExtension = (fileName: string): boolean => {
  const lower = fileName.toLowerCase()
  return UNSUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

/**
 * Combina el sniffing por bytes con la extensión.
 *
 * Precedencia:
 * 1. Firmas binarias fuertes (PDF, ZIP/XLSX, OLE) mandan sobre la extensión,
 *    así un PDF nombrado `.csv` se parsea como PDF.
 * 2. Extensiones explícitamente no soportadas (imágenes, comprimidos, etc.)
 *    se rechazan aunque el contenido parezca texto.
 * 3. La extensión conocida manda sobre la heurística de texto.
 * 4. Sin extensión conocida, un contenido de texto se trata como CSV.
 */
export const resolveFileFormat = (
  fileName: string,
  buffer?: ArrayBuffer
): FileFormat => {
  if (isUnsupportedExtension(fileName)) return "unknown"

  const fromExtension = extensionFormat(fileName)

  if (buffer && buffer.byteLength > 0) {
    const sniffed = sniffFormatFromBytes(buffer)
    if (sniffed === "pdf" || sniffed === "excel") return sniffed
    if (fromExtension !== "unknown") return fromExtension
    if (sniffed === "csv") return "csv"
  }

  return fromExtension
}

interface BankSignature {
  name: string
  pattern: RegExp
}

const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/**
 * Firmas de bancos de Honduras y la región. Se comparan contra el texto
 * normalizado (sin acentos, minúsculas). El orden importa: las firmas más
 * específicas van primero.
 */
const BANK_SIGNATURES: readonly BankSignature[] = [
  {
    name: "BAC Credomatic",
    pattern: /bac\s*credomatic|bac\s*credito|bac\s*credomatico/,
  },
  { name: "Banco Atlántida", pattern: /banco\s+atlantida|bancatlan|atlantida/ },
  { name: "Banco Ficohsa", pattern: /ficohsa|banco\s+ficohsa/ },
  { name: "Banco del País", pattern: /banco\s+del\s+pais|banpais/ },
  { name: "Banco Davivienda", pattern: /davivienda/ },
  {
    name: "Banco de Desarrollo Rural",
    pattern: /banrural|banco\s+de\s+desarrollo\s+rural/,
  },
  {
    name: "Banco Agrícola Mercantil",
    pattern: /banco\s+agricola\s+mercantil|\bbam\b/,
  },
  { name: "Banco Lafise", pattern: /lafise|banco\s+lafise/ },
  { name: "Banco Promerica", pattern: /promerica/ },
  {
    name: "Banco de Occidente",
    pattern: /banco\s+de\s+occidente|banco\s+occidente/,
  },
  { name: "Banco Cuscatlán", pattern: /cuscatlan/ },
]

/** Devuelve el nombre del banco detectado en el texto, o `null`. */
export const detectBank = (text: string): string | null => {
  if (!text) return null
  const normalized = stripAccents(text).toLowerCase()
  for (const signature of BANK_SIGNATURES) {
    if (signature.pattern.test(normalized)) return signature.name
  }
  return null
}

const CURRENCY_HINTS: ReadonlyArray<{ code: CurrencyCode; pattern: RegExp }> = [
  { code: "HNL", pattern: /\bhnl\b|\blempiras?\b|\blps\b|\bl\.?(?=\s*\d)/g },
  { code: "USD", pattern: /\busd\b|\bdolares?\b|\bus\s*\$|\$\s*\d/g },
  { code: "GTQ", pattern: /\bgtq\b|\bquetzales?\b|\bq\.?(?=\s*\d)/g },
  { code: "CRC", pattern: /\bcrc\b|\bcolones?\b|₡/g },
  { code: "NIO", pattern: /\bnio\b|\bcordobas?\b/g },
  { code: "EUR", pattern: /\beur\b|\beuros?\b|€/g },
]

/**
 * Infiere la moneda del archivo contando apariciones de su símbolo/código.
 * Devuelve `null` si no hay evidencia o si hay empate.
 */
export const detectCurrencyFromText = (text: string): CurrencyCode | null => {
  if (!text) return null
  const normalized = stripAccents(text).toLowerCase()

  let best: CurrencyCode | null = null
  let bestCount = 0
  let tied = false

  for (const hint of CURRENCY_HINTS) {
    const matches = normalized.match(hint.pattern)
    const count = matches?.length ?? 0
    if (count === 0) continue

    if (count > bestCount) {
      best = hint.code
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }

  return tied ? null : best
}
