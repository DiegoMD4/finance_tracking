/**
 * Capa de decodificación y normalización de texto del motor de parsers.
 *
 * El objetivo es que todos los consumidores reciban texto limpio y sin
 * mojibake, sin importar si el archivo venía en UTF-8, UTF-16 o CP1252.
 *
 * El módulo corre tanto en el browser como en Node (tests): por eso no
 * importa nada de `node:*` y usa `TextDecoder` cuando está disponible,
 * con un fallback propio cuando no lo está.
 */

export interface DecodedText {
  text: string
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "windows-1252"
  hadBom: boolean
}

type TextEncoding = DecodedText["encoding"]

/** Mapa CP1252 para el rango 0x80–0x9F (el resto es idéntico a Latin-1). */
const CP1252_HIGH: readonly number[] = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
]

/**
 * Devuelve el constructor de `TextDecoder` disponible en el entorno.
 * Se resuelve en cada llamada para que los tests puedan simular su ausencia.
 */
const getTextDecoder = (): typeof TextDecoder | null =>
  typeof TextDecoder === "undefined" ? null : TextDecoder

/* ----------------------------------------------------------------------------
 * Decodificadores
 * ------------------------------------------------------------------------- */

/** Decodifica UTF-8 estricto. Devuelve `null` si la secuencia no es válida. */
const decodeUtf8Strict = (bytes: Uint8Array): string | null => {
  const TextDecoderImpl = getTextDecoder()

  if (TextDecoderImpl) {
    try {
      return new TextDecoderImpl("utf-8", { fatal: true }).decode(bytes)
    } catch {
      // Secuencia inválida (o encoding no soportado): probamos el fallback.
    }
  }

  return decodeUtf8Manual(bytes)
}

/** Decodifica UTF-8 sin lanzar: reemplaza bytes inválidos si hace falta. */
const decodeUtf8Lenient = (bytes: Uint8Array): string => {
  const TextDecoderImpl = getTextDecoder()

  if (TextDecoderImpl) {
    try {
      return new TextDecoderImpl("utf-8").decode(bytes)
    } catch {
      // Sin soporte de UTF-8: seguimos con el fallback manual.
    }
  }

  return decodeUtf8Manual(bytes) ?? decodeCp1252Manual(bytes)
}

/** Decodifica CP1252, usando `TextDecoder` si el entorno lo soporta. */
const decodeCp1252 = (bytes: Uint8Array): string => {
  const TextDecoderImpl = getTextDecoder()

  if (TextDecoderImpl) {
    try {
      return new TextDecoderImpl("windows-1252").decode(bytes)
    } catch {
      // Entornos con ICU reducido: caemos al decodificador propio.
    }
  }

  return decodeCp1252Manual(bytes)
}

/** Decodifica UTF-16 respetando el extremo indicado por el BOM. */
const decodeUtf16 = (
  bytes: Uint8Array,
  encoding: "utf-16le" | "utf-16be"
): string => {
  const TextDecoderImpl = getTextDecoder()

  if (TextDecoderImpl) {
    try {
      return new TextDecoderImpl(encoding).decode(bytes)
    } catch {
      // Sin soporte de UTF-16: seguimos con el fallback manual.
    }
  }

  return decodeUtf16Manual(bytes, encoding === "utf-16le")
}

/** Decodificador UTF-8 propio: valida secuencias y rechaza overlong/surrogates. */
const decodeUtf8Manual = (bytes: Uint8Array): string | null => {
  const characters: string[] = []
  let index = 0

  while (index < bytes.length) {
    const lead = bytes[index]
    let codePoint: number
    let size: number

    if (lead < 0x80) {
      codePoint = lead
      size = 1
    } else if (lead >= 0xc2 && lead <= 0xdf) {
      if (index + 1 >= bytes.length) return null
      const b1 = bytes[index + 1]
      if (!isContinuation(b1)) return null
      codePoint = ((lead & 0x1f) << 6) | (b1 & 0x3f)
      size = 2
    } else if (lead >= 0xe0 && lead <= 0xef) {
      if (index + 2 >= bytes.length) return null
      const b1 = bytes[index + 1]
      const b2 = bytes[index + 2]
      if (!isContinuation(b1) || !isContinuation(b2)) return null
      // Rechaza overlongs (E0 A0..) y surrogates (ED 80..9F).
      if (lead === 0xe0 && b1 < 0xa0) return null
      if (lead === 0xed && b1 > 0x9f) return null
      codePoint = ((lead & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)
      size = 3
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      if (index + 3 >= bytes.length) return null
      const b1 = bytes[index + 1]
      const b2 = bytes[index + 2]
      const b3 = bytes[index + 3]
      if (!isContinuation(b1) || !isContinuation(b2) || !isContinuation(b3)) {
        return null
      }
      // Rechaza overlongs (F0 80..8F) y valores fuera de U+10FFFF (F4 90..).
      if (lead === 0xf0 && b1 < 0x90) return null
      if (lead === 0xf4 && b1 > 0x8f) return null
      codePoint =
        ((lead & 0x07) << 18) |
        ((b1 & 0x3f) << 12) |
        ((b2 & 0x3f) << 6) |
        (b3 & 0x3f)
      size = 4
    } else {
      return null
    }

    characters.push(String.fromCodePoint(codePoint))
    index += size
  }

  return characters.join("")
}

/** Decodificador CP1252 propio: tabla para 0x80–0x9F, identidad en el resto. */
const decodeCp1252Manual = (bytes: Uint8Array): string => {
  const characters: string[] = []

  for (const byte of bytes) {
    const codePoint =
      byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte
    characters.push(String.fromCharCode(codePoint))
  }

  return characters.join("")
}

/** Decodificador UTF-16 propio, usado solo si no hay `TextDecoder`. */
const decodeUtf16Manual = (bytes: Uint8Array, littleEndian: boolean): string => {
  const codeUnits: string[] = []

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const unit = littleEndian
      ? bytes[index] | (bytes[index + 1] << 8)
      : (bytes[index] << 8) | bytes[index + 1]
    codeUnits.push(String.fromCharCode(unit))
  }

  return codeUnits.join("")
}

const isContinuation = (byte: number): boolean => byte >= 0x80 && byte <= 0xbf

/* ----------------------------------------------------------------------------
 * API pública
 * ------------------------------------------------------------------------- */

/** Decodifica bytes a string detectando BOM/UTF-8/CP1252. */
export const decodeBytes = (buffer: ArrayBuffer): DecodedText => {
  const bytes = new Uint8Array(buffer)

  // 1) BOM UTF-8
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return {
      text: normalizeText(decodeUtf8Lenient(bytes.subarray(3))),
      encoding: "utf-8",
      hadBom: true,
    }
  }

  // 2) BOM UTF-16LE (se chequea antes que BE porque comparten el byte FF/FE)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: normalizeText(decodeUtf16(bytes.subarray(2), "utf-16le")),
      encoding: "utf-16le",
      hadBom: true,
    }
  }

  // 3) BOM UTF-16BE
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: normalizeText(decodeUtf16(bytes.subarray(2), "utf-16be")),
      encoding: "utf-16be",
      hadBom: true,
    }
  }

  // 4) Sin BOM: UTF-8 estricto y, si falla, CP1252.
  const utf8 = decodeUtf8Strict(bytes)
  if (utf8 !== null) {
    return { text: normalizeText(utf8), encoding: "utf-8", hadBom: false }
  }

  const encoding: TextEncoding = "windows-1252"
  return {
    text: normalizeText(decodeCp1252(bytes)),
    encoding,
    hadBom: false,
  }
}

/** Limpieza y normalización de texto para parsing. */
export const normalizeText = (input: string): string => {
  let text = input.normalize("NFKC")

  // Caracteres invisibles: BOM/ZWNBSP y zero-width spaces/joiners.
  text = text.replace(/[\uFEFF\u200B\u200C\u200D]/g, "")

  // Espacios "raros" que no deben romper el splitting por columnas.
  text = text.replace(/[\u00A0\u202F\u2007]/g, " ")

  // Saltos de línea unificados, sin dejar CR sueltos.
  text = text.replace(/\r\n?/g, "\n")

  // Signos tipográficos equivalentes a ASCII.
  text = text.replace(/[\u2212\u2013\u2014]/g, "-")
  text = text.replace(/[\u2018\u2019]/g, "'")
  text = text.replace(/[\u201C\u201D]/g, '"')

  // Colapsa runs de espacios/tabs horizontales (nunca toca el \n).
  text = text.replace(/[^\S\n]+/g, " ")

  const lines = text.split("\n").map((line) => line.trim())

  // Conserva las líneas vacías intermedias (separan bloques de tablas),
  // pero descarta las vacías del final.
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  return lines.join("\n")
}

/**
 * Si el texto arranca con una línea `sep=;` (formato que genera Excel al
 * exportar), la quita y devuelve el delimitador indicado.
 *
 * Solo se examina la primera línea no vacía: es la única posición en la que
 * Excel escribe esta directiva.
 */
export const stripSepLine = (
  text: string
): { text: string; delimiter: string | null } => {
  const lines = text.split("\n")

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === "") continue

    // Misma intención que /^sep\s*=\s*(.)$/i, tolerando espacios sobrantes
    // alrededor de la línea (Excel suele agregar un espacio antes del tab).
    const match = line.match(/^\s*sep\s*=\s*(.)\s*$/i)
    if (!match) return { text, delimiter: null }

    const remaining = [...lines.slice(0, index), ...lines.slice(index + 1)]
    return { text: remaining.join("\n"), delimiter: match[1] }
  }

  return { text, delimiter: null }
}

/** Heurística para sniffing: ¿el buffer parece texto plano (CSV/TXT) y no binario? */
export const looksLikeText = (buffer: ArrayBuffer): boolean => {
  const bytes = new Uint8Array(buffer)
  const sample = bytes.subarray(0, 4096)

  // Un archivo vacío no es binario; la decisión final queda para el caller.
  if (sample.length === 0) return true

  // Un BOM UTF-16 no es texto "plano" según esta heurística.
  const hasUtf16Bom =
    sample.length >= 2 &&
    ((sample[0] === 0xff && sample[1] === 0xfe) ||
      (sample[0] === 0xfe && sample[1] === 0xff))
  if (hasUtf16Bom) return false

  let controlBytes = 0

  for (const byte of sample) {
    if (byte === 0x00) return false
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue
    if (byte < 0x20 || byte === 0x7f) controlBytes += 1
  }

  return controlBytes / sample.length <= 0.05
}
