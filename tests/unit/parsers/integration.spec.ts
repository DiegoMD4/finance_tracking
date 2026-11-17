import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"

import { parseCsv } from "@/lib/parsers/csv-parser"
import { parseExcel } from "@/lib/parsers/excel-parser"
import { extractTransactions } from "@/lib/parsers/file-extractor"

const CSV_MIME = "text/csv"
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** CSV de texto plano (UTF-8 sin BOM). */
function csvFile(content: string, name = "estado.csv"): File {
  return new File([content], name, { type: CSV_MIME })
}

/** File binario a partir de bytes crudos, sin usar `Buffer` ni `node:*`. */
function bytesFile(values: readonly number[], name: string): File {
  return new File([Uint8Array.from(values)], name, { type: CSV_MIME })
}

/**
 * Bytes CP1252 armados a mano: los strings se codifican como Latin-1
 * (suficiente para ASCII y acentos) y los numbers se insertan tal cual.
 */
function cp1252Bytes(...parts: Array<string | number>): number[] {
  const bytes: number[] = []

  for (const part of parts) {
    if (typeof part === "number") {
      bytes.push(part)
      continue
    }

    for (const char of part) bytes.push(char.charCodeAt(0))
  }

  return bytes
}

/** Bytes UTF-16LE precedidos por el BOM FF FE. */
function utf16leBytes(text: string): number[] {
  const bytes = [0xff, 0xfe]

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    bytes.push(code & 0xff, code >> 8)
  }

  return bytes
}

interface SheetSpec {
  name: string
  rows: (string | number)[][]
}

/** Libro XLSX en memoria con una o más hojas. */
function workbookFile(sheets: SheetSpec[], name = "libro.xlsx"): File {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(sheet.rows),
      sheet.name
    )
  }

  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer

  return new File([buffer], name, { type: XLSX_MIME })
}

/** Libro de una sola hoja "Movimientos". */
function xlsxFile(rows: (string | number)[][], name = "movs.xlsx"): File {
  return workbookFile([{ name: "Movimientos", rows }], name)
}

/** CSV con preámbulo de dos líneas, una línea vacía y cabecera con `;`. */
const preambleCsv = [
  "Banco Atlántida",
  "Cuenta: 1234-5678",
  "",
  "Fecha;Descripción;Débito;Crédito;Saldo",
  "07/09/2026;Supermercado;500,00;;1500,00",
  "08/09/2026;Salario;;1000,00;2500,00",
].join("\n")

describe("parseCsv (integración)", () => {
  it("I-01:detecta la cabecera tras el preámbulo y delimita con ;", async () => {
    // Dado: un CSV con dos líneas de metadata, una línea vacía y cabecera con ;
    const file = csvFile(preambleCsv)

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: las dos filas de datos se convierten en transacciones
    expect(result.source).toBe("csv")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.detection?.headerRow).not.toBeNull()

    // Y: el débito es gasto con coma decimal y el crédito es ingreso
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      transactionDescription: "Supermercado",
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDate: "2026-09-08",
      transactionDescription: "Salario",
      transactionType: "income",
      amount: "1000.00",
    })

    // Y: se informa el delimitador realmente usado para partir las columnas
    expect(result.detection?.delimiter).toBe(";")
  })

  it("I-02:numera las filas absolutas contando el preámbulo completo", async () => {
    // Dado: el mismo CSV, cuya cabecera es la línea 4 del archivo
    const file = csvFile(preambleCsv)

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: headerRow es la fila 4 y los datos arrancan en la 5 y la 6
    expect({
      headerRow: result.detection?.headerRow ?? null,
      rows: result.transactions.map((transaction) => transaction.row ?? null),
    }).toEqual({ headerRow: 4, rows: [5, 6] })
  })

  it("I-03:quita la directiva sep=; y no reporta errores de columnas", async () => {
    // Dado: un CSV exportado por Excel que arranca con sep=;
    const file = csvFile(
      [
        "sep=;",
        "fecha;descripcion;monto",
        "07/09/2026;Compra;-500,00",
        "08/09/2026;Salario;1500,00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: la directiva se elimina, se delimita con ; y no hay errores
    expect(result.errors).toEqual([])
    expect(result.detection?.delimiter).toBe(";")
    expect(result.detection?.headerRow).toBe(1)
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions.map((transaction) => transaction.amount)).toEqual(
      ["500.00", "1500.00"]
    )
    expect(
      (result.warnings ?? []).filter((warning) => /fields/i.test(warning))
    ).toEqual([])
  })

  it("I-04:decodifica UTF-8 con BOM y conserva los acentos", async () => {
    // Dado: un CSV UTF-8 con BOM y una descripción acentuada
    const text = [
      "fecha,descripcion,monto",
      "07/09/2026,Café con leche,-500.00",
      "08/09/2026,Salario,1500.00",
    ].join("\n")
    const file = bytesFile(
      [0xef, 0xbb, 0xbf, ...Array.from(new TextEncoder().encode(text))],
      "bom.csv"
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: el BOM se descarta, se reporta UTF-8 y los acentos quedan intactos
    expect(result.detection?.encoding).toBe("utf-8")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Café con leche",
      transactionType: "expense",
      amount: "500.00",
    })
  })

  it("I-05:decodifica CP1252 armado a mano y detecta la descripción", async () => {
    // Dado: un CSV CP1252 con 0xF3 (ó) y 0xE9 (é) en cabecera y datos
    const file = bytesFile(
      cp1252Bytes(
        "fecha;descripci",
        0xf3,
        "n;d",
        0xe9,
        "bito;cr",
        0xe9,
        "dito;saldo\n",
        "07/09/2026;Compra supermercado;500,00;;1500,00\n",
        "08/09/2026;Dep",
        0xf3,
        "sito de n",
        0xf3,
        "mina;;1000,00;2500,00"
      ),
      "cp1252.csv"
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: se reinterpreta como windows-1252 sin mojibake
    expect(result.detection?.encoding).toBe("windows-1252")
    expect(result.detection?.columns.description).toBeTypeOf("number")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].transactionDescription).toBe(
      "Compra supermercado"
    )
    expect(result.transactions[1].transactionDescription).toBe(
      "Depósito de nómina"
    )

    // Y: ninguna descripción cae al fallback por no poder leer la columna
    expect(
      result.transactions.filter(
        (transaction) => transaction.transactionDescription === "No description"
      )
    ).toEqual([])
    expect(result.rawText).toContain("descripción")
    expect(result.rawText).toContain("débito")
    expect(result.rawText).toContain("nómina")
  })

  it("I-06:decodifica UTF-16LE con BOM", async () => {
    // Dado: el mismo CSV codificado en UTF-16LE con BOM FF FE
    const text = [
      "fecha;descripcion;monto",
      "07/09/2026;Café;-500,00",
      "08/09/2026;Salario;1500,00",
    ].join("\n")
    const file = bytesFile(utf16leBytes(text), "utf16.csv")

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: se decodifica UTF-16LE y se parsean ambas filas
    expect(result.detection?.encoding).toBe("utf-16le")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Café",
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDescription: "Salario",
      transactionType: "income",
      amount: "1500.00",
    })
  })

  it("I-07:interpreta miles latinos 1.234 y negativos entre paréntesis", async () => {
    // Dado: un CSV con separador de miles y un monto contable negativo
    const file = csvFile(
      [
        "fecha,descripcion,monto",
        "07/09/2026,Compra grande,1.234",
        "08/09/2026,Reembolso,(500.00)",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: 1.234 son miles y (500.00) es un egreso
    expect(result.errors).toEqual([])
    expect(result.transactions[0]).toMatchObject({
      transactionType: "income",
      amount: "1234.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionType: "expense",
      amount: "500.00",
    })
  })

  it("I-08:usa una columna Monto firmada para decidir income/expense", async () => {
    // Dado: un CSV con una única columna Monto con signo
    const file = csvFile(
      [
        "Fecha,Descripción,Monto",
        "07/09/2026,Supermercado,-500.00",
        "08/09/2026,Salario,1500.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: el signo decide el tipo y el monto guardado es positivo
    expect(result.errors).toEqual([])
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Supermercado",
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDescription: "Salario",
      transactionType: "income",
      amount: "1500.00",
    })
  })

  it("I-09:descarta filas con débito y crédito en cero", async () => {
    // Dado: un CSV con una fila donde débito y crédito valen 0.00
    const file = csvFile(
      [
        "fecha,descripcion,debito,credito",
        "07/09/2026,Compra,500.00,",
        "08/09/2026,Fila cero,0.00,0.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: solo queda la fila válida y la cero se reporta como error
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].transactionDescription).toBe("Compra")
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("amount")
    expect(result.errors[0]).toContain("Row 3")
  })

  it("I-10:advierte cuando el saldo corrido no cierra", async () => {
    // Dado: un CSV con Saldo donde la segunda fila rompe el saldo corrido
    const file = csvFile(
      [
        "fecha,descripcion,monto,saldo",
        "07/09/2026,Compra,-500.00,1500.00",
        "08/09/2026,Pago,-200.00,9999.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: se guardan las transacciones pero se avisa del descuadre
    expect(result.transactions).toHaveLength(2)
    expect(result.detection?.balanceChecked).toBe(true)
    expect(
      (result.warnings ?? []).some((warning) =>
        warning.includes("balance mismatch")
      )
    ).toBe(true)
  })

  it("I-11:valida el saldo corrido cuando es coherente", async () => {
    // Dado: un CSV con Saldo coherente (1500 - 200 = 1300)
    const file = csvFile(
      [
        "fecha,descripcion,monto,saldo",
        "07/09/2026,Compra,-500.00,1500.00",
        "08/09/2026,Pago,-200.00,1300.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: el saldo se marca como validado y no hay warnings de saldo
    expect(result.detection?.balanceChecked).toBe(true)
    expect(
      (result.warnings ?? []).filter((warning) =>
        warning.includes("balance mismatch")
      )
    ).toEqual([])
  })

  it("I-12:expone los índices de columnas detectados en el CSV", async () => {
    // Dado: el CSV con preámbulo del caso I-01
    const file = csvFile(preambleCsv)

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: cada rol apunta a su columna real y hay confianza
    expect(result.detection?.columns).toMatchObject({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      balance: 4,
    })
    expect(result.detection?.confidence ?? 0).toBeGreaterThan(0)
  })

  it("I-13:reporta error cuando no hay ninguna cabecera válida", async () => {
    // Dado: un CSV sin fecha ni montos reconocibles
    const file = csvFile(
      ["Reporte de movimientos", "sin columnas reconocibles"].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: no hay transacciones y se informa la falta de cabecera
    expect(result.transactions).toEqual([])
    expect(result.errors).toEqual([
      "No se encontró una fila de cabecera válida en el archivo CSV",
    ])
    expect(result.detection?.headerRow).toBeNull()
  })
})

describe("parseExcel (integración)", () => {
  it("I-14:detecta la cabecera tras un preámbulo de 3 filas", async () => {
    // Dado: una hoja con tres filas de preámbulo y la cabecera en la fila 4
    const file = xlsxFile([
      ["Banco Atlántida", "", ""],
      ["Cuenta 1234-5678", "", ""],
      ["Período 2026-09", "", ""],
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Supermercado", -500],
      ["08/09/2026", "Salario", 1500],
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: la cabecera es la fila 4 y los datos arrancan en la 5
    expect(result.source).toBe("excel")
    expect(result.errors).toEqual([])
    expect(result.detection?.headerRow).toBe(4)
    expect(result.detection?.sheetName).toBe("Movimientos")
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions.map((transaction) => transaction.row)).toEqual([
      5, 6,
    ])
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Supermercado",
      transactionType: "expense",
      amount: "500.00",
    })
  })

  it("I-15:elige la segunda hoja cuando la primera no tiene cabecera", async () => {
    // Dado: un libro con una hoja de resumen y otra con los movimientos
    const file = workbookFile([
      {
        name: "Resumen",
        rows: [["Resumen de cuenta"], ["Cuenta", "1234-5678"]],
      },
      {
        name: "Movimientos",
        rows: [
          ["Fecha", "Descripción", "Monto"],
          ["07/09/2026", "Compra", -500],
          ["08/09/2026", "Salario", 1500],
        ],
      },
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: se elige la hoja con movimientos y se parsea completa
    expect(result.errors).toEqual([])
    expect(result.detection?.sheetName).toBe("Movimientos")
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[1]).toMatchObject({
      transactionDescription: "Salario",
      transactionType: "income",
      amount: "1500.00",
    })
  })

  it("I-16:convierte un serial de Excel a fecha ISO", async () => {
    // Dado: una fecha guardada como serial 45930
    const file = xlsxFile([
      ["Fecha", "Descripción", "Monto"],
      [45930, "Compra", -100],
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: el serial corresponde al 30 de septiembre de 2025
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2025-09-30",
      transactionDescription: "Compra",
      transactionType: "expense",
      amount: "100.00",
    })
  })
})

describe("extractTransactions (integración)", () => {
  it("I-17:delega un .xlsx en parseExcel", async () => {
    // Dado: un libro XLSX válido con un movimiento
    const file = xlsxFile([
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", -500],
    ])

    // Cuando: se extraen las transacciones
    const result = await extractTransactions(file)

    // Entonces: la fuente es excel y la fila se convierte en transacción
    expect(result.source).toBe("excel")
    expect(result.fileName).toBe("movs.xlsx")
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Compra",
      transactionType: "expense",
      amount: "500.00",
    })
  })

  it("I-18:delega un .csv en parseCsv", async () => {
    // Dado: un CSV válido con un movimiento
    const file = csvFile(
      [
        "fecha,descripcion,monto",
        "07/09/2026,Compra,-500.00",
      ].join("\n"),
      "extracto.csv"
    )

    // Cuando: se extraen las transacciones
    const result = await extractTransactions(file)

    // Entonces: la fuente es csv y la fila se convierte en transacción
    expect(result.source).toBe("csv")
    expect(result.fileName).toBe("extracto.csv")
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      transactionDescription: "Compra",
      transactionType: "expense",
      amount: "500.00",
    })
  })
})
