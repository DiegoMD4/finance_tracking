import type { DedupeOriginal } from "@/lib/parsers/types"
import { formatAmount, parseAmount } from "@/lib/parsers/core/money"

/**
 * Utilidades de deduplicación para importaciones masivas.
 *
 * Este módulo es isomorfo a propósito: lo importa el parser (que corre en el
 * cliente) para asignar ocurrencias, y también el servidor. Por eso no usa
 * `node:crypto`; el hash vive en `dedupe-hash.ts`, que es solo de servidor.
 *
 * La identidad de una fila se congela al parsear (ver `DedupeSnapshot`): el
 * hash se calcula con los valores originales, nunca con los editados en la
 * previsualización.
 */

/** `dedupe_occurrence` es SMALLINT UNSIGNED. */
export const DEDUPE_MAX_OCCURRENCE = 65_535

/** Separador de la preimagen: no aparece en texto normal. */
export const DEDUPE_PREIMAGE_SEPARATOR = "\u001F"

/** Límite de `decimal(12, 2)`: 9_999_999_999.99. */
const DEDUPE_AMOUNT_LIMIT = 10_000_000_000

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g
const COMBINING_MARKS = /\p{M}/gu

/**
 * Normaliza texto para el hash: NFKC (compatibilidad), NFD + quita acentos,
 * quita caracteres de ancho cero, colapsa espacios y pasa a mayúsculas.
 * Alineado con la colación `utf8mb4_0900_ai_ci` de la tabla.
 */
export const normalizeForHash = (text: string | null | undefined): string => {
  if (typeof text !== "string" || text.length === 0) return ""

  return text
    .normalize("NFKC")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

/**
 * Lleva un monto a la forma canónica que se guarda en la columna:
 * `"45.5"` → `"45.50"`, `"1,234.56"` → `"1234.56"`, `"1234,56"` → `"1234.56"`.
 *
 * Reutiliza `parseAmount` para que el snapshot (dato de cliente) se
 * interprete exactamente igual que el resto de montos del parser.
 * Devuelve `null` si el monto no es válido o no cabe en `decimal(12, 2)`.
 */
export const canonicalAmount = (
  raw: string | null | undefined
): string | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) return null

  const parsed = parseAmount(raw)
  if (parsed.value === null || !Number.isFinite(parsed.value)) return null

  const absolute = Math.abs(parsed.value)
  if (absolute >= DEDUPE_AMOUNT_LIMIT) return null

  return formatAmount(absolute)
}

/** `true` si el valor puede guardarse en `dedupe_occurrence`. */
export const isValidOccurrence = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= DEDUPE_MAX_OCCURRENCE

export interface DedupeIdentityInput {
  /** `null` al asignar ocurrencias dentro de un archivo (la cuenta es única). */
  accountId: number | null
  /** Moneda con la que se identifica la fila (la del snapshot). */
  currency: string | null
  original: DedupeOriginal
}

/**
 * Preimagen del hash, unida con `\u001F`:
 *
 *   accountId | fecha | monto canónico | tipo | moneda | referencia o descripción
 *
 * La referencia manda sobre la descripción: si existe, la descripción no
 * participa (el banco puede redactarla distinto entre CSV y PDF).
 */
export const buildDedupePreimage = ({
  accountId,
  currency,
  original,
}: DedupeIdentityInput): string => {
  const reference = normalizeForHash(original.reference)
  const description = normalizeForHash(original.description)

  return [
    accountId === null ? "" : String(accountId),
    original.date.trim(),
    canonicalAmount(original.amount) ?? "",
    original.type,
    normalizeForHash(currency),
    reference || description,
  ].join(DEDUPE_PREIMAGE_SEPARATOR)
}

export interface DedupeCandidate {
  currency: string | null
  original: DedupeOriginal
}

/**
 * Asigna la ocurrencia (1..n) de cada fila dentro del archivo, en orden
 * estable. Se ejecuta al parsear, sobre **todas** las filas del archivo: borrar
 * o editar filas en la previsualización no renumera nada.
 */
export const assignOccurrences = (
  items: ReadonlyArray<DedupeCandidate>
): number[] => {
  const counts = new Map<string, number>()

  return items.map((item) => {
    const key = buildDedupePreimage({
      accountId: null,
      currency: item.currency,
      original: item.original,
    })
    const next = (counts.get(key) ?? 0) + 1
    counts.set(key, next)
    return next
  })
}
