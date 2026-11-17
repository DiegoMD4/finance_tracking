export type CurrencyCode =
  | "HNL"
  | "USD"
  | "EUR"
  | "GTQ"
  | "CRC"
  | "NIO"
  | "DOP"
  | "PEN"
  | "MXN"
  | "COP"
  | "ARS"
  | "CLP"
  | "PYG"
  | "BOB"
  | "UYU"

export interface ParsedAmount {
  value: number | null

  negative: boolean

  currency: CurrencyCode | null

  raw: string
}

export interface ParseAmountOptions {
  currency?: CurrencyCode | null

  decimalSeparator?: "." | ","
}

const CURRENCY_RULES: ReadonlyArray<readonly [CurrencyCode, RegExp]> = [
  ["DOP", /\bRD\s*\$|\bDOP\b|\bPESOS?\s+DOMINICANOS?\b/i],
  ["NIO", /\bC\s*\$|\bNIO\b|\bCORDOBAS?\b/i],
  ["PEN", /\bS\s*\/|\bPEN\b|\bSOLES?\b/i],
  ["MXN", /\bMX\s*\$|\bMXN\b/i],
  ["BOB", /\bBOB\b|\bBS\.?(?=\s*[\d(])/i],
  ["PYG", /₲|\bPYG\b|\bGUARANI(?:ES)?\b/i],
  ["UYU", /\bUYU\b|\$U\b/i],
  ["CRC", /₡|\bCRC\b|\bCOLONES?\b/i],
  ["GTQ", /\bGTQ\b|\bQUETZALES?\b|(?:^|[\s(])Q\.?(?=\s*[\d(])/i],
  ["EUR", /€|\bEUR\b|\bEUROS?\b/i],
  ["USD", /\bUS\s*\$|\bU\$S\b|\bUSD\b|\bDOLAR(?:ES)?\b|\$/i],
  ["HNL", /\bHNL\b|\bLPS\b|\bLEMPIRAS?\b|(?:^|[\s(])L\.?(?=\s*[\d(])/i],
  ["COP", /\bCOP\b/i],
  ["ARS", /\bARS\b|\bAR\s*\$/i],
  ["CLP", /\bCLP\b/i],
]

const normalizeNumericText = (input: string): string =>
  input
    .normalize("NFKC")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u2212\u2013\u2014]/g, "-")

const detectCurrency = (text: string): CurrencyCode | null => {
  for (const [code, pattern] of CURRENCY_RULES) {
    if (pattern.test(text)) return code
  }
  return null
}

const applyDecimalHint = (digits: string, separator: "." | ","): string => {
  const thousands = separator === "." ? "," : "."
  let out = digits.split(thousands).join("")
  if (separator === ",") out = out.replace(/,/g, ".")
  return out
}

const normalizeSeparators = (digits: string): string => {
  const hasDot = digits.includes(".")
  const hasComma = digits.includes(",")

  if (hasDot && hasComma) {
    const lastDot = digits.lastIndexOf(".")
    const lastComma = digits.lastIndexOf(",")
    return lastComma > lastDot
      ? digits.replace(/\./g, "").replace(",", ".")
      : digits.replace(/,/g, "")
  }

  if (!hasDot && !hasComma) return digits

  const separator = hasDot ? "." : ","
  const parts = digits.split(separator)

  if (parts.length > 2) return parts.join("")

  const [integerPart, fractionPart] = parts

  if (!fractionPart) return integerPart || "0"

  const looksLikeThousands =
    fractionPart.length === 3 &&
    integerPart.length > 0 &&
    integerPart.length <= 3 &&
    integerPart !== "0"

  if (looksLikeThousands) return integerPart + fractionPart

  return `${integerPart || "0"}.${fractionPart}`
}

export const parseAmount = (
  raw: string,
  options: ParseAmountOptions = {}
): ParsedAmount => {
  const original = raw == null ? "" : String(raw)
  const fallback: ParsedAmount = {
    value: null,
    negative: false,
    currency: options.currency ?? null,
    raw: original,
  }

  let text = normalizeNumericText(original).trim()
  if (!text) return fallback

  const currency = detectCurrency(text) ?? options.currency ?? null

  text = text
    .replace(/\bRD\s*\$/gi, " ")
    .replace(/\bC\s*\$/gi, " ")
    .replace(/\bMX\s*\$/gi, " ")
    .replace(/\bUS\s*\$/gi, " ")
    .replace(/\bS\s*\/(?=\s*[\d(])/gi, " ")
    .replace(/\bBS\.?(?=\s*[\d(])/gi, " ")
    .replace(
      /\b(?:HNL|LPS|USD|EUR|GTQ|CRC|NIO|DOP|PEN|MXN|COP|ARS|CLP|PYG|BOB|UYU)\.?\b/gi,
      " "
    )
    .replace(/\bL\.?(?=\s*[\d(])/gi, " ")
    .replace(/\bQ\.?(?=\s*[\d(])/gi, " ")
    .replace(/[₡€$]/g, " ")
    .trim()

  let negative = false
  if (/\(\s*[^()]*\d[^()]*\)/.test(text)) {
    negative = true
    text = text.replace(/[()]/g, " ")
  }

  if (text.includes("-")) {
    negative = true
    text = text.replace(/-/g, " ")
  }

  const digits = text.replace(/[^\d.,]/g, "")
  if (!/\d/.test(digits)) return fallback

  const normalized = options.decimalSeparator
    ? applyDecimalHint(digits, options.decimalSeparator)
    : normalizeSeparators(digits)

  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return fallback

  const absolute = Math.round((Math.abs(numeric) + Number.EPSILON) * 100) / 100
  // No propagar el signo a cero: evita `-0` y "-0.00".
  const value = negative && absolute !== 0 ? -absolute : absolute

  return {
    value,
    negative: negative && absolute !== 0,
    currency,
    raw: original,
  }
}

export const formatAmount = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "0.00"
  const normalized = Math.abs(value) < 0.005 ? 0 : value
  return normalized.toFixed(2)
}

export const amountToPositiveString = (value: number | null): string =>
  formatAmount(value === null ? null : Math.abs(value))

export const looksLikeAmount = (raw: string): boolean => /\d/.test(raw ?? "")
