/**
 * Reconstrucción de la estructura de un PDF a partir de los `TextItem` de
 * pdf.js.
 *
 * pdf.js entrega cada fragmento de texto con su matriz de transformación
 * (`transform[4]` = X, `transform[5]` = Y), ancho y alto. Perder esa
 * información (como hacía `items.map(i => i.str).join(" ")`) obliga a adivinar
 * las columnas con regex. Aquí se agrupan los fragmentos por línea (Y) y se
 * unen en celdas por proximidad horizontal (X), que es lo que necesita el
 * motor genérico de tablas.
 */

export interface PdfTextItem {
  str: string
  transform: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

export interface PdfCell {
  text: string
  /** Borde izquierdo de la celda, en puntos PDF. */
  x: number
  /** Borde derecho de la celda, en puntos PDF. */
  xEnd: number
}

export interface PdfRow {
  /** Coordenada Y de la línea (las filas se devuelven de arriba hacia abajo). */
  y: number
  cells: PdfCell[]
}

export interface PdfLayoutOptions {
  /** Tolerancia vertical para considerar dos fragmentos de la misma línea. */
  yTolerance?: number
  /** Hueco horizontal máximo para unir fragmentos en una misma celda. */
  mergeGap?: number
}

interface PositionedItem {
  text: string
  x: number
  xEnd: number
  y: number
  height: number
}

const isTextItem = (item: unknown): item is PdfTextItem => {
  if (!item || typeof item !== "object") return false
  const candidate = item as PdfTextItem
  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    candidate.transform.length >= 6
  )
}

const positionItem = (item: PdfTextItem): PositionedItem | null => {
  const text = item.str
  if (!text || text.trim() === "") return null

  const rawX = item.transform[4]
  const rawY = item.transform[5]
  // `Number(null)` y `Number(undefined)` devuelven 0; se exige un número real
  // para no inventar una fila en el origen.
  if (typeof rawX !== "number" || typeof rawY !== "number") return null

  const x = rawX
  const y = rawY
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  const height = Math.abs(Number(item.height)) || 10
  const measuredWidth = Math.abs(Number(item.width))
  // Algunos generadores no informan `width`; se estima con el tamaño de fuente.
  const width =
    measuredWidth > 0 ? measuredWidth : text.length * height * 0.5

  return { text, x, xEnd: x + width, y, height }
}

/**
 * Agrupa los fragmentos en filas (por Y) y los une en celdas (por X).
 *
 * - La tolerancia vertical por defecto es 3pt, suficiente para ignorar
 *   diferencias de baseline sin mezclar renglones.
 * - Dos fragmentos se unen en la misma celda si el hueco es menor a
 *   `max(3, altura * 0.7)`. Entre columnas el hueco es mucho mayor.
 * - Cuando el hueco supera el ancho estimado de un espacio, se inserta un
 *   espacio para no pegar palabras.
 */
export const buildPdfRows = (
  items: readonly unknown[],
  options: PdfLayoutOptions = {}
): PdfRow[] => {
  const yTolerance = options.yTolerance ?? 3

  const positioned = items
    .filter(isTextItem)
    .map(positionItem)
    .filter((item): item is PositionedItem => item !== null)

  if (positioned.length === 0) return []

  // Ordenar de arriba hacia abajo (Y decreciente) y de izquierda a derecha.
  positioned.sort((a, b) => b.y - a.y || a.x - b.x)

  const groups: { y: number; items: PositionedItem[] }[] = []
  for (const item of positioned) {
    const current = groups[groups.length - 1]
    if (current && Math.abs(current.y - item.y) <= yTolerance) {
      current.items.push(item)
    } else {
      groups.push({ y: item.y, items: [item] })
    }
  }

  return groups.map((group) => {
    const ordered = [...group.items].sort((a, b) => a.x - b.x)
    const averageHeight =
      ordered.reduce((total, item) => total + item.height, 0) / ordered.length

    const mergeGap = options.mergeGap ?? Math.max(3, averageHeight * 0.7)
    const spaceThreshold = Math.max(0.6, averageHeight * 0.08)

    const cells: PdfCell[] = []

    for (const item of ordered) {
      const last = cells[cells.length - 1]
      const gap = last ? item.x - last.xEnd : Number.POSITIVE_INFINITY

      if (last && gap <= mergeGap) {
        const needsSpace =
          gap > spaceThreshold &&
          !/\s$/.test(last.text) &&
          !/^\s/.test(item.text)
        last.text = `${last.text}${needsSpace ? " " : ""}${item.text}`
        last.xEnd = Math.max(last.xEnd, item.xEnd)
      } else {
        cells.push({ text: item.text, x: item.x, xEnd: item.xEnd })
      }
    }

    return {
      y: group.y,
      cells: cells.map((cell) => ({
        ...cell,
        text: cell.text.replace(/\s+/g, " ").trim(),
      })),
    }
  })
}

/** Reconstruye un texto plano legible a partir de las filas detectadas. */
export const pdfRowsToText = (rows: readonly PdfRow[]): string =>
  rows
    .map((row) => row.cells.map((cell) => cell.text).join(" ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
