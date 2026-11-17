import { describe, expect, it } from "vitest"

import { parsePdfPages, parsePdfRows } from "@/lib/parsers/pdf/generic-pdf"
import {
  buildPdfRows,
  pdfRowsToText,
  type PdfCell,
  type PdfRow,
  type PdfTextItem,
} from "@/lib/parsers/pdf/layout"

/** Ancho por carácter del helper: 5pt para una fuente de 10pt. */
const CHAR_WIDTH = 5
const FONT_HEIGHT = 10
const LINE_STEP = 20
const FIRST_LINE_Y = 700

/** Arma un `TextItem` de pdf.js con la matriz de transformación estándar. */
const item = (
  str: string,
  x: number,
  y: number,
  width = str.length * CHAR_WIDTH
): PdfTextItem => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  width,
  height: FONT_HEIGHT,
})

const cell = (text: string, x: number, xEnd: number): PdfCell => ({
  text,
  x,
  xEnd,
})

/** Posiciones X de las columnas de un estado de cuenta típico. */
const COLUMN = {
  date: { x: 50, label: "Fecha" },
  description: { x: 120, label: "Descripción" },
  debit: { x: 300, label: "Débito" },
  credit: { x: 380, label: "Crédito" },
  balance: { x: 460, label: "Saldo" },
} as const

const COLUMN_ORDER = [
  "date",
  "description",
  "debit",
  "credit",
  "balance",
] as const

type ColumnKey = (typeof COLUMN_ORDER)[number]

/** Borde derecho de la columna según el ancho de su cabecera. */
const columnEnd = (key: ColumnKey): number =>
  COLUMN[key].x + COLUMN[key].label.length * CHAR_WIDTH

interface StatementRow {
  date?: string
  description?: string
  debit?: string
  credit?: string
  balance?: string
}

const headerItems = (y: number): PdfTextItem[] =>
  COLUMN_ORDER.map((key) => item(COLUMN[key].label, COLUMN[key].x, y))

/** Coloca un monto alineado a la derecha contra el borde de su columna. */
const amountItem = (text: string, column: ColumnKey, y: number): PdfTextItem => {
  const end = columnEnd(column)
  return item(text, end - text.length * CHAR_WIDTH, y)
}

const dataRowItems = (row: StatementRow, y: number): PdfTextItem[] => {
  const items: PdfTextItem[] = []
  if (row.date) items.push(item(row.date, COLUMN.date.x, y))
  if (row.description) {
    items.push(item(row.description, COLUMN.description.x, y))
  }
  if (row.debit) items.push(amountItem(row.debit, "debit", y))
  if (row.credit) items.push(amountItem(row.credit, "credit", y))
  if (row.balance) items.push(amountItem(row.balance, "balance", y))
  return items
}

/**
 * Construye los fragmentos de un estado de cuenta completo: el literal
 * `"header"` inserta la fila de cabecera y cada objeto una fila de datos.
 */
const statementItems = (
  specs: readonly (StatementRow | "header")[],
  startY = FIRST_LINE_Y
): PdfTextItem[] =>
  specs.flatMap((spec, index) => {
    const y = startY - index * LINE_STEP
    return spec === "header" ? headerItems(y) : dataRowItems(spec, y)
  })

const statementRows = (
  specs: readonly (StatementRow | "header")[]
): PdfRow[] => buildPdfRows(statementItems(specs))

/** Tabla base reutilizada por varios casos de `parsePdfRows`. */
const HAPPY_PATH: readonly (StatementRow | "header")[] = [
  "header",
  {
    date: "07/09/2026",
    description: "Compra supermercado",
    debit: "500.00",
    balance: "10,500.00",
  },
  {
    date: "08/09/2026",
    description: "Depósito nómina",
    credit: "2,500.00",
    balance: "13,000.00",
  },
]

describe("buildPdfRows", () => {
  it("T-01:agrupa fragmentos por Y y ordena las filas de arriba hacia abajo", () => {
    // Dado: tres fragmentos, dos de ellos casi a la misma altura
    const items = [
      item("Primera línea", 50, 200),
      item("Misma fila", 200, 199),
      item("Abajo", 50, 100),
    ]

    // Cuando: se reconstruyen las filas
    const rows = buildPdfRows(items)

    // Entonces: hay dos filas, primero la más alta y cada una con sus celdas
    expect(rows).toHaveLength(2)
    expect(rows[0]?.y).toBe(200)
    expect(rows[0]?.cells.map((entry) => entry.text)).toEqual([
      "Primera línea",
      "Misma fila",
    ])
    expect(rows[1]?.y).toBe(100)
    expect(rows[1]?.cells.map((entry) => entry.text)).toEqual(["Abajo"])
  })

  it("T-02:une fragmentos cercanos en X y separa los que tienen hueco grande", () => {
    // Dado: dos fragmentos con un hueco chico y otros dos con uno grande
    const items = [
      item("Hola", 50, 200, 20),
      item("Mundo", 72, 200, 25),
      item("Izquierda", 50, 100, 40),
      item("Derecha", 200, 100, 30),
    ]

    // Cuando: se reconstruyen las filas
    const rows = buildPdfRows(items)

    // Entonces: la fila superior queda en una celda y la inferior en dos
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells).toHaveLength(1)
    expect(rows[0]?.cells[0]?.text).toBe("Hola Mundo")
    expect(rows[1]?.cells.map((entry) => entry.text)).toEqual([
      "Izquierda",
      "Derecha",
    ])
  })

  it("T-03:ordena las celdas por X dentro de la fila", () => {
    // Dado: fragmentos de una misma línea en orden inverso
    const items = [
      item("Tercera", 300, 100),
      item("Primera", 50, 100),
      item("Segunda", 170, 100),
    ]

    // Cuando: se reconstruye la fila
    const rows = buildPdfRows(items)

    // Entonces: las celdas quedan de izquierda a derecha
    expect(rows).toHaveLength(1)
    expect(rows[0]?.cells.map((entry) => entry.text)).toEqual([
      "Primera",
      "Segunda",
      "Tercera",
    ])
  })

  it("T-04:descarta ítems vacíos o con transform inválido", () => {
    // Dado: una mezcla de ítems inválidos y uno válido
    const items: unknown[] = [
      null,
      undefined,
      42,
      {},
      { str: "   ", transform: [1, 0, 0, 1, 50, 100] },
      { str: "", transform: [1, 0, 0, 1, 50, 100] },
      { str: "Válido", transform: [1, 0, 0, 1, 50, 100] },
    ]

    // Cuando: se reconstruyen las filas
    const rows = buildPdfRows(items)

    // Entonces: solo sobrevive el ítem con texto y coordenadas válidas
    expect(rows).toHaveLength(1)
    expect(rows[0]?.cells.map((entry) => entry.text)).toEqual(["Válido"])
  })

  it("T-05:estima el ancho cuando el ítem no trae width ni height", () => {
    // Dado: dos fragmentos sin width (uno sin height tampoco)
    const items: unknown[] = [
      { str: "SinAncho", transform: [1, 0, 0, 1, 50, 200], height: 10 },
      { str: "SinAltura", transform: [1, 0, 0, 1, 50, 100] },
    ]

    // Cuando: se reconstruyen las filas
    const rows = buildPdfRows(items)

    // Entonces: el ancho se estima con el tamaño de fuente (8 y 9 caracteres)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells[0]?.xEnd).toBe(90)
    expect(rows[1]?.cells[0]?.xEnd).toBe(95)
  })

  it("T-06:yTolerance custom agrupa filas que por defecto quedan separadas", () => {
    // Dado: dos fragmentos con 5pt de diferencia vertical
    const items = [item("Uno", 50, 100), item("Dos", 200, 105)]

    // Cuando: se reconstruyen las filas con la tolerancia por defecto y con 6
    const byDefault = buildPdfRows(items)
    const relaxed = buildPdfRows(items, { yTolerance: 6 })

    // Entonces: por defecto son dos filas y con la tolerancia custom una sola
    expect(byDefault).toHaveLength(2)
    expect(relaxed).toHaveLength(1)
    expect(relaxed[0]?.cells.map((entry) => entry.text)).toEqual(["Uno", "Dos"])
  })
})

describe("pdfRowsToText", () => {
  it("T-07:une celdas con espacio y descarta líneas vacías", () => {
    // Dado: filas con celdas, una fila en blanco y una sin celdas
    const rows: PdfRow[] = [
      { y: 30, cells: [cell("Fecha", 0, 20), cell("Monto", 40, 60)] },
      { y: 20, cells: [cell("   ", 0, 5)] },
      { y: 10, cells: [] },
      { y: 0, cells: [cell("Saldo", 0, 20)] },
    ]

    // Cuando: se convierte el layout a texto plano
    const text = pdfRowsToText(rows)

    // Entonces: las celdas se separan con un espacio y no quedan líneas vacías
    expect(text).toBe("Fecha Monto\nSaldo")
  })
})

describe("parsePdfRows", () => {
  it("T-08:parsea una tabla feliz con débito y crédito", () => {
    // Dado: cabecera Fecha/Descripción/Débito/Crédito/Saldo con dos filas
    const rows = statementRows(HAPPY_PATH)

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: hay dos transacciones con tipo y monto correctos
    expect(result?.source).toBe("pdf")
    expect(result?.errors).toEqual([])
    expect(result?.transactions).toHaveLength(2)
    expect(result?.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      transactionDescription: "Compra supermercado",
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result?.transactions[1]).toMatchObject({
      transactionDate: "2026-09-08",
      transactionDescription: "Depósito nómina",
      transactionType: "income",
      amount: "2500.00",
    })
  })

  it("T-09:devuelve null sin cabecera reconocible", () => {
    // Dado: un título y texto suelto, sin columnas ni montos
    const items = [
      item("ESTADO DE CUENTA", 50, 700),
      item("Banco Atlántida S.A.", 50, 680),
      item("Estimado cliente: aquí está el resumen de su cuenta", 50, 660),
    ]

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(buildPdfRows(items), { fileName: "estado.pdf" })

    // Entonces: no se reconoce una tabla y se devuelve null
    expect(result).toBeNull()
  })

  it("T-10:no confunde una cabecera sin fechas debajo con una tabla", () => {
    // Dado: una fila que parece cabecera pero debajo solo hay texto
    const rows = statementRows([
      "header",
      { date: "Resumen", description: "de cuenta" },
      { date: "Período", description: "septiembre de dos mil veintiséis" },
    ])

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: al no haber ninguna fecha debajo, no hay cabecera
    expect(result).toBeNull()
  })

  it("T-11:ignora una cabecera repetida en medio del documento", () => {
    // Dado: la cabecera aparece otra vez entre las dos filas de datos
    const rows = statementRows([
      "header",
      {
        date: "07/09/2026",
        description: "Compra supermercado",
        debit: "500.00",
        balance: "10,500.00",
      },
      "header",
      {
        date: "08/09/2026",
        description: "Depósito nómina",
        credit: "2,500.00",
        balance: "13,000.00",
      },
    ])

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: la repetición no genera transacción adicional ni error
    expect(result?.transactions).toHaveLength(2)
    expect(result?.errors).toEqual([])
  })

  it("T-12:concatena una continuación de la descripción anterior", () => {
    // Dado: una fila solo con texto en la columna Descripción
    const rows = statementRows([
      "header",
      {
        date: "07/09/2026",
        description: "Compra supermercado",
        debit: "500.00",
        balance: "10,500.00",
      },
      { description: "Sucursal Centro" },
      {
        date: "08/09/2026",
        description: "Depósito nómina",
        credit: "2,500.00",
        balance: "13,000.00",
      },
    ])

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: el texto se suma a la descripción previa y no crea otra fila
    expect(result?.transactions).toHaveLength(2)
    expect(result?.transactions[0]?.transactionDescription).toBe(
      "Compra supermercado Sucursal Centro"
    )
    expect(result?.transactions[1]?.transactionDescription).toBe(
      "Depósito nómina"
    )
  })

  it("T-13:descarta filas de resumen y pie sin errores de fecha", () => {
    // Dado: dos filas de movimientos seguidas de un resumen y un pie
    const rows = statementRows([
      "header",
      {
        date: "07/09/2026",
        description: "Compra supermercado",
        debit: "500.00",
        balance: "10,500.00",
      },
      {
        date: "08/09/2026",
        description: "Depósito nómina",
        credit: "2,500.00",
        balance: "13,000.00",
      },
      { description: "Saldo anterior", balance: "1,000.00" },
      { description: "Total", balance: "13,000.00" },
      { date: "Documento generado automáticamente" },
    ])

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: solo quedan las transacciones reales y ningún error de fecha
    expect(result?.transactions).toHaveLength(2)
    expect(result?.errors).toEqual([])
    expect(
      result?.warnings?.some((warning) => warning.includes("invalid date"))
    ).toBe(false)
  })

  it("T-14:propaga el banco y reporta la detección del layout", () => {
    // Dado: las mismas filas pero con un banco informado por el llamador
    const rows = statementRows(HAPPY_PATH)

    // Cuando: se parsean indicando banco
    const result = parsePdfRows(rows, {
      fileName: "estado.pdf",
      bank: "Banco Atlántida",
    })

    // Entonces: la detección identifica el formato, el banco y la cabecera
    expect(result?.detection?.bank).toBe("Banco Atlántida")
    expect(result?.detection?.format).toBe("pdf")
    expect(result?.detection?.headerRow).toBe(1)
    expect(result?.detection?.columns).toMatchObject({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      balance: 4,
    })
  })

  it("T-15:mapea débito y crédito solo por posición, sin símbolos de moneda", () => {
    // Dado: montos sin símbolo y una descripción que también trae números
    const rows = statementRows([
      "header",
      {
        date: "01/09/2026",
        description: "Pago factura 123",
        debit: "1,250.00",
      },
      {
        date: "02/09/2026",
        description: "Ajuste 456",
        credit: "890.00",
      },
    ])

    // Cuando: se parsean las filas reconstruidas
    const result = parsePdfRows(rows, { fileName: "estado.pdf" })

    // Entonces: los números se anclan por su borde derecho y los textos por X
    expect(result?.transactions[0]).toMatchObject({
      transactionDescription: "Pago factura 123",
      transactionType: "expense",
      amount: "1250.00",
    })
    expect(result?.transactions[1]).toMatchObject({
      transactionDescription: "Ajuste 456",
      transactionType: "income",
      amount: "890.00",
    })
  })
})

describe("parsePdfPages", () => {
  it("T-16:junta las filas de dos páginas en un solo resultado", () => {
    // Dado: una primera página con dos movimientos y una segunda con uno más
    const pageOne = statementItems([
      "header",
      {
        date: "07/09/2026",
        description: "Compra supermercado",
        debit: "500.00",
        balance: "10,500.00",
      },
      {
        date: "08/09/2026",
        description: "Depósito nómina",
        credit: "2,500.00",
        balance: "13,000.00",
      },
    ])
    const pageTwo = statementItems([
      "header",
      {
        date: "09/09/2026",
        description: "Pago servicios",
        debit: "300.00",
        balance: "12,700.00",
      },
    ])

    // Cuando: se parsean las dos páginas juntas
    const result = parsePdfPages([pageOne, pageTwo], { fileName: "estado.pdf" })

    // Entonces: las tres transacciones quedan en el mismo resultado
    expect(result?.transactions).toHaveLength(3)
    expect(result?.transactions.map((transaction) => transaction.amount)).toEqual([
      "500.00",
      "2500.00",
      "300.00",
    ])
    expect(result?.errors).toEqual([])
  })
})

describe("robustez de la extracción posicional", () => {
  it("T-17:devuelve null con páginas o filas vacías", () => {
    // Dado: entradas sin ningún fragmento de texto
    const options = { fileName: "vacio.pdf" }

    // Cuando: se intenta parsear por filas y por páginas
    const byRows = parsePdfRows([], options)
    const byPages = parsePdfPages([], options)

    // Entonces: ambos caminos devuelven null sin lanzar
    expect(byRows).toBeNull()
    expect(byPages).toBeNull()
  })

  it("T-18:ignora ítems con transform no numérico sin excepción", () => {
    // Dado: un ítem válido junto a otros con coordenadas no numéricas
    const items: unknown[] = [
      item("Bueno", 50, 100),
      { str: "Sin coordenadas", transform: ["a", "b", "c", "d", "e", "f"] },
      { str: "Parcial", transform: [1, 0, 0, 1, "x", 100] },
    ]

    // Cuando: se reconstruyen las filas
    const rows = buildPdfRows(items)

    // Entonces: los ítems inválidos se descartan y solo queda el válido
    expect(rows).toHaveLength(1)
    expect(rows[0]?.cells.map((entry) => entry.text)).toEqual(["Bueno"])
  })
})
