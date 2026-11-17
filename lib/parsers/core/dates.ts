/**
 * Parseo y validación de fechas bancarias.
 *
 * Reemplaza las tres copias de `normalizeDate`. Mejoras principales frente a
 * la versión anterior:
 *
 * - Valida que la fecha exista en el calendario (`31/02/2026` ya no pasa).
 * - Soporta más formatos (`DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY/MM/DD`, ISO con
 *   hora, `07 Sep 2026`, `Sep 7, 2026`, `07-SEP-26`, `YYYYMMDD`, seriales de
 *   Excel y timestamps epoch).
 * - Resuelve la ambigüedad día/mes por archivo con `resolveDayFirst`.
 */

export type DateConfidence = "high" | "medium" | "low"

export interface ParsedDate {
  /** Fecha normalizada en formato `YYYY-MM-DD`. */
  iso: string
  confidence: DateConfidence
}

export interface ParseDateOptions {
  /**
   * Interpreta `01/02/2026` como día/mes. Si no se indica, se usa `true`
   * (Latinoamérica) salvo que el primer número sea mayor a 12.
   */
  dayFirst?: boolean
  /** Año mínimo aceptado (default 1900). */
  minYear?: number
  /** Año máximo aceptado (default 2100). */
  maxYear?: number
}

const MONTHS: Record<string, number> = {
  // Español (abreviaturas y nombres completos)
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  set: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
  // Inglés
  jan: 1,
  january: 1,
  apr: 4,
  april: 4,
  aug: 8,
  august: 8,
  dec: 12,
  december: 12,
  february: 2,
  july: 7,
  june: 6,
  march: 3,
  november: 11,
  october: 10,
  september: 9,
}

const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const expandYear = (year: number): number => {
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

const pad2 = (value: number): string => String(value).padStart(2, "0")

const buildIso = (
  year: number,
  month: number,
  day: number,
  options: ParseDateOptions
): string | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const minYear = options.minYear ?? 1900
  const maxYear = options.maxYear ?? 2100

  if (year < minYear || year > maxYear) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  // Validación real de calendario (incluye años bisiestos).
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${pad2(month)}-${pad2(day)}`
}

const serialToIso = (serial: number, options: ParseDateOptions): string | null => {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null
  // Epoch de Excel: 1899-12-30 (contempla el bug del 29/02/1900).
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000
  const date = new Date(ms)
  return buildIso(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    options
  )
}

const epochToIso = (value: number, options: ParseDateOptions): string | null => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return buildIso(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    options
  )
}

/**
 * Convierte un texto a `YYYY-MM-DD`, validando el calendario.
 * Devuelve `null` si no es una fecha reconocible.
 */
export const parseDate = (
  raw: string,
  options: ParseDateOptions = {}
): ParsedDate | null => {
  if (raw == null) return null

  let value = stripAccents(String(raw)).toLowerCase().trim()
  if (!value) return null

  // Quitar componente de hora: "2026-09-07T00:00:00Z", "07/09/2026 00:00:00",
  // "2026-Sep-07 12:30 p.m.".
  value = value.replace(
    /[ t]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:z|[+-]\d{2}:?\d{2})?$/,
    ""
  )
  value = value.replace(/\s+/g, " ").trim()
  if (!value) return null

  // 2026-09-07 / 2026/09/07
  const ymd = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (ymd) {
    const iso = buildIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), options)
    return iso ? { iso, confidence: "high" } : null
  }

  // 2026-Sep-07 / 2026-septiembre-07
  const yMonthDay = value.match(/^(\d{4})-([a-z]{3,12})\.?-(\d{1,2})$/)
  if (yMonthDay) {
    const month = MONTHS[yMonthDay[2]]
    if (!month) return null
    const iso = buildIso(Number(yMonthDay[1]), month, Number(yMonthDay[3]), options)
    return iso ? { iso, confidence: "high" } : null
  }

  // 7 de septiembre de 2026
  const dayDeMonthDeYear = value.match(
    /^(\d{1,2})\s+de\s+([a-z]{3,12})\s+de\s+(\d{2,4})$/
  )
  if (dayDeMonthDeYear) {
    const month = MONTHS[dayDeMonthDeYear[2]]
    if (!month) return null
    const iso = buildIso(
      expandYear(Number(dayDeMonthDeYear[3])),
      month,
      Number(dayDeMonthDeYear[1]),
      options
    )
    return iso ? { iso, confidence: "high" } : null
  }

  // 07 Sep 2026 / 07-sep-26 / 07/Sep/2026 / 07 Sep, 2026
  const dayMonthYear = value.match(
    /^(\d{1,2})[-/ ]([a-z]{3,12})[-/ ,]+(\d{2,4})$/
  )
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2]]
    if (!month) return null
    const iso = buildIso(
      expandYear(Number(dayMonthYear[3])),
      month,
      Number(dayMonthYear[1]),
      options
    )
    return iso ? { iso, confidence: "high" } : null
  }

  // Sep 7, 2026 / September 7 2026
  const monthDayYear = value.match(
    /^([a-z]{3,12})[-/ ](\d{1,2})(?:,)?[-/ ](\d{2,4})$/
  )
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1]]
    if (!month) return null
    const iso = buildIso(
      expandYear(Number(monthDayYear[3])),
      month,
      Number(monthDayYear[2]),
      options
    )
    return iso ? { iso, confidence: "high" } : null
  }

  // 07/09/2026, 07-09-2026, 07.09.2026, 7/9/26
  const numeric = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const year = expandYear(Number(numeric[3]))

    if (first > 12 && second <= 12) {
      const iso = buildIso(year, second, first, options)
      return iso ? { iso, confidence: "high" } : null
    }

    if (second > 12 && first <= 12) {
      const iso = buildIso(year, first, second, options)
      return iso ? { iso, confidence: "high" } : null
    }

    const dayFirst = options.dayFirst ?? true
    const iso = dayFirst
      ? buildIso(year, second, first, options)
      : buildIso(year, first, second, options)

    return iso ? { iso, confidence: "medium" } : null
  }

  // 20260907 (YYYYMMDD) o 07092026 (DDMMYYYY)
  if (/^\d{8}$/.test(value)) {
    const firstFour = Number(value.slice(0, 4))
    if (firstFour >= 1900 && firstFour <= 2100) {
      const iso = buildIso(
        firstFour,
        Number(value.slice(4, 6)),
        Number(value.slice(6, 8)),
        options
      )
      return iso ? { iso, confidence: "high" } : null
    }

    const lastFour = Number(value.slice(4, 8))
    if (lastFour >= 1900 && lastFour <= 2100) {
      const iso = buildIso(
        lastFour,
        Number(value.slice(2, 4)),
        Number(value.slice(0, 2)),
        options
      )
      return iso ? { iso, confidence: "low" } : null
    }
  }

  // Timestamps epoch (segundos o milisegundos). Se exige que no tengan ceros
  // a la izquierda para no confundir números de referencia con fechas.
  if (/^[1-9]\d{12}$/.test(value)) {
    const iso = epochToIso(Number(value), options)
    return iso ? { iso, confidence: "low" } : null
  }

  if (/^[1-9]\d{9}$/.test(value)) {
    const iso = epochToIso(Number(value) * 1000, options)
    return iso ? { iso, confidence: "low" } : null
  }

  // Serial de Excel (5 dígitos, típicamente 20000..80000).
  if (/^\d{5,6}$/.test(value)) {
    const serial = Number(value)
    const iso = serialToIso(serial, options)
    return iso ? { iso, confidence: "low" } : null
  }

  return null
}

/**
 * Decide el orden día/mes observando todas las fechas numéricas del archivo.
 * Si aparece algún primer número mayor a 12, el archivo es día/mes; si aparece
 * un segundo número mayor a 12, es mes/día. Sin evidencia se asume día/mes.
 */
export const resolveDayFirst = (samples: readonly string[]): boolean => {
  let dayFirstVotes = 0
  let monthFirstVotes = 0

  for (const sample of samples) {
    if (!sample) continue
    const match = String(sample)
      .trim()
      .match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
    if (!match) continue

    const first = Number(match[1])
    const second = Number(match[2])

    if (first > 12 && second <= 12) dayFirstVotes += 1
    else if (second > 12 && first <= 12) monthFirstVotes += 1
  }

  if (dayFirstVotes > 0 && monthFirstVotes === 0) return true
  if (monthFirstVotes > 0 && dayFirstVotes === 0) return false
  return true
}

/** `true` si `iso` es una fecha `YYYY-MM-DD` que existe en el calendario. */
export const isValidIsoDate = (iso: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "")
  if (!match) return false
  return (
    buildIso(Number(match[1]), Number(match[2]), Number(match[3]), {}) === iso
  )
}
