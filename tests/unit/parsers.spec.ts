import { afterEach, describe, expect, it, vi } from "vitest"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
  extractTransactions,
  getFileSource,
} from "@/lib/parsers/file-extractor"
import {
  cleanAmount,
  normalizeDate,
  parseCsv,
} from "@/lib/parsers/csv-parser"
import { parseExcel } from "@/lib/parsers/excel-parser"
import { parseAtlántidaPDF } from "@/lib/parsers/atlantida-pdf-parser"

function csvFile(content: string, name = "estado.csv"): File {
  return new File([content], name, { type: "text/csv" })
}

function xlsxFile(rows: (string | number)[][], name = "movs.xlsx"): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos")
  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer

  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("getFileSource", () => {
  it("L-13: detecta archivos CSV", () => {
    expect(getFileSource("estado.csv")).toBe("csv")
  })

  it("L-14: detecta archivos Excel", () => {
    expect(getFileSource("movs.xlsx")).toBe("excel")
  })

  it("L-15: detecta archivos PDF", () => {
    expect(getFileSource("estado.pdf")).toBe("pdf")
  })

  it("L-16: retorna unknown para formatos no soportados", () => {
    expect(getFileSource("foto.jpg")).toBe("unknown")
  })
})

describe("parseCsv", () => {
  it("L-17: parsea un CSV válido y guarda los montos positivos", async () => {
    // Dado: un CSV con un gasto negativo y un ingreso positivo
    const file = csvFile(
      [
        "fecha,descripcion,monto",
        "07/09/2026,Supermercado,-500.00",
        "08/09/2026,Salario,1500.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: ambas filas se convierten en transacciones sin errores
    expect(result.source).toBe("csv")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)

    // Y: el signo define el tipo, pero el monto se guarda positivo
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      transactionDescription: "Supermercado",
      transactionType: "expense",
      amount: "500.00",
      bankReference: null,
      row: 2,
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDate: "2026-09-08",
      transactionDescription: "Salario",
      transactionType: "income",
      amount: "1500.00",
      row: 3,
    })
  })

  it("L-18: omite la fila con fecha inválida y reporta el error", async () => {
    // Dado: una fila con una fecha que no coincide con ningún formato
    const file = csvFile(
      [
        "fecha,descripcion,monto",
        "07/09/2026,Supermercado,-500.00",
        "basura,Otro,100.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: solo se conserva la fila válida y se informa la fila 3
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].transactionDescription).toBe("Supermercado")
    expect(result.errors).toEqual(['Row 3: invalid date ("basura")'])
  })

  it("L-19: usa las columnas débito/crédito cuando no hay monto", async () => {
    // Dado: un CSV con headers acentuados en singular y sin columna monto
    const file = csvFile(
      [
        "fecha,descripcion,débito,crédito",
        "07/09/2026,Compra,300.00,",
        "08/09/2026,Depósito,,500.00",
      ].join("\n")
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(file, file.name)

    // Entonces: el débito es gasto y el crédito es ingreso
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionDescription: "Compra",
      transactionType: "expense",
      amount: "300.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDescription: "Depósito",
      transactionType: "income",
      amount: "500.00",
    })
  })

  it("L-20: reporta un error cuando Papa no puede leer el archivo", async () => {
    // Dado: Papa.parse falla antes de emitir el callback complete
    vi.spyOn(Papa, "parse").mockImplementation(
      ((_source: unknown, config: { error?: (error: Error, file: File) => void }) => {
        config.error?.(new Error("read failure"), new File([], "estado.csv"))
      }) as typeof Papa.parse
    )

    // Cuando: se parsea el archivo
    const result = await parseCsv(csvFile("fecha,descripcion,monto"), "estado.csv")

    // Entonces: se resuelve con el error genérico y sin transacciones
    expect(result.transactions).toEqual([])
    expect(result.errors).toEqual(["Could not read the CSV file"])
    expect(result.source).toBe("csv")
  })
})

describe("parseExcel", () => {
  it("L-21: parsea un Excel válido con columnas débito/crédito", async () => {
    // Dado: una hoja con headers acentuados y filas de gasto/ingreso
    const file = xlsxFile([
      ["Fecha", "Descripción", "Débito", "Crédito"],
      ["07/09/2026", "Supermercado", 500, 0],
      ["08/09/2026", "Salario", 0, 1500],
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: cada fila se convierte en una transacción del tipo correcto
    expect(result.source).toBe("excel")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
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
      amount: "1500.00",
    })
  })

  it("L-22: convierte un serial de Excel a YYYY-MM-DD", async () => {
    // Dado: una fecha guardada como número de serie de Excel
    const file = xlsxFile([
      ["Fecha", "Descripción", "Monto"],
      [45930, "Compra", -100],
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: el serial 45930 corresponde al 30 de septiembre de 2025
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2025-09-30",
      transactionDescription: "Compra",
      transactionType: "expense",
      amount: "100.00",
    })
  })

  it("L-23: reporta un error cuando no encuentra la fila de cabecera", async () => {
    // Dado: una hoja sin ninguna celda de fecha conocida
    const file = xlsxFile([
      ["foo", "bar"],
      ["1", "2"],
    ])

    // Cuando: se parsea el archivo
    const result = await parseExcel(file, file.name)

    // Entonces: no hay transacciones y se informa el problema
    expect(result.transactions).toEqual([])
    expect(result.errors).toEqual([
      "No se encontró la fila de cabecera en el archivo Excel",
    ])
  })
})

describe("parseAtlántidaPDF", () => {
  it("L-24: parsea el formato 1 con fechas DD/MM/YYYY y montos L", () => {
    // Dado: un texto con dos movimientos del formato 1
    const text = [
      "07/09/2026 REF001 Compra supermercado L 500.00 L 0.00 L 1500.00",
      "08/09/2026 REF002 Deposito salario L 0.00 L 2000.00 L 3500.00",
    ].join("\n")

    // Cuando: se parsea el texto
    const result = parseAtlántidaPDF(text, "estado.pdf")

    // Entonces: se detectan gasto e ingreso con sus referencias
    expect(result.source).toBe("pdf")
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      bankReference: "REF001",
      transactionDescription: "Compra supermercado",
      transactionType: "expense",
      amount: "500.00",
      row: 1,
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDate: "2026-09-08",
      bankReference: "REF002",
      transactionDescription: "Deposito salario",
      transactionType: "income",
      amount: "2000.00",
      row: 2,
    })
  })

  it("L-25: parsea el formato 2 con fechas YYYY-Mes-DD", () => {
    // Dado: un texto con dos movimientos del formato 2
    const text = [
      "2026-Sep-07 REF010 Compra supermercado 500.00 0.00 1500.00",
      "2026-Sep-08 REF011 Deposito salario 0.00 2000.00 3500.00",
    ].join("\n")

    // Cuando: se parsea el texto
    const result = parseAtlántidaPDF(text, "estado.pdf")

    // Entonces: las fechas se normalizan y los montos se asignan por columna
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-09-07",
      bankReference: "REF010",
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionDate: "2026-09-08",
      bankReference: "REF011",
      transactionType: "income",
      amount: "2000.00",
    })
  })

  it("L-26: reporta un error cuando no hay movimientos", () => {
    // Dado: un texto que no coincide con ninguno de los dos formatos
    const result = parseAtlántidaPDF(
      "Estado de cuenta sin movimientos",
      "estado.pdf"
    )

    // Entonces: no hay transacciones y se informa el problema
    expect(result.transactions).toEqual([])
    expect(result.errors).toEqual([
      "No valid movements detected in Banco Atlántida PDF",
    ])
  })
})

describe("extractTransactions", () => {
  it("L-27: rechaza un archivo con formato desconocido", async () => {
    // Dado: un archivo PNG
    const file = new File(["contenido"], "foto.png", { type: "image/png" })

    // Cuando: se intenta extraer transacciones
    const result = await extractTransactions(file)

    // Entonces: se informa el formato incompatible sin intentar parsearlo
    expect(result.transactions).toEqual([])
    expect(result.source).toBe("unknown")
    expect(result.fileName).toBe("foto.png")
    expect(result.errors).toEqual([
      'Incompatible file format: "foto.png". Use .csv, .xlsx, .xls or .pdf',
    ])
  })
})

describe("cleanAmount", () => {
  it("L-28: convierte el formato europeo 1.234,56", () => {
    expect(cleanAmount("1.234,56")).toBe("1234.56")
  })

  it("L-29: limpia el símbolo L y el separador de miles", () => {
    expect(cleanAmount("L 3,300.00")).toBe("3300.00")
  })
})

describe("normalizeDate", () => {
  it("L-30: convierte DD/MM/YYYY a YYYY-MM-DD", () => {
    expect(normalizeDate("07/09/2026")).toBe("2026-09-07")
  })

  it("L-31: convierte YYYY-Mes-DD a YYYY-MM-DD", () => {
    expect(normalizeDate("2026-Sep-07")).toBe("2026-09-07")
  })
})
