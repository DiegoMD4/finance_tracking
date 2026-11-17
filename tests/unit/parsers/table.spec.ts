import { describe, expect, it } from "vitest"
import {
  detectHeader,
  mapColumns,
  mappingToColumnIndexes,
  normalizeCell,
  parseTable,
  reconcileBalances,
  resolveTypeFromLabel,
  toMatrix,
  type ColumnMapping,
  type Matrix,
  type TableParseOptions,
} from "@/lib/parsers/core/table"

type ExtraOptions = Partial<Omit<TableParseOptions, "fileName" | "source">>

/** Ejecuta `parseTable` con los valores por defecto de un CSV de prueba. */
function parseCsv(matrix: Matrix, options: ExtraOptions = {}) {
  return parseTable(matrix, {
    fileName: "test.csv",
    source: "csv",
    ...options,
  })
}

describe("detección de cabecera", () => {
  it("T-01:detecta la cabecera en la primera fila", () => {
    // Dado: una matriz que empieza directamente con la cabecera
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "500.00"],
    ]

    // Cuando: se detecta la cabecera y se parsea la tabla
    const detection = detectHeader(matrix)
    const result = parseCsv(matrix)

    // Entonces: la cabecera está en la posición 0 y en la fila 1 (1-based)
    expect(detection?.rowIndex).toBe(0)
    expect(result.headerRow).toBe(1)
    expect(result.transactions).toHaveLength(1)
  })

  it("T-02:salta un preámbulo de tres filas y numera de forma absoluta", () => {
    // Dado: nombre del banco, cuenta, línea vacía y luego la cabecera
    const matrix: Matrix = [
      ["Banco Atlántida S.A."],
      ["Cuenta: 12345678"],
      [""],
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la cabecera es la fila 4 y el primer dato la fila 5
    expect(result.headerRow).toBe(4)
    expect(result.transactions[0]?.row).toBe(5)
  })

  it("T-03:mapea cabeceras con acentos y mayúsculas", () => {
    // Dado: cabeceras en español con tildes y mayúsculas
    const headers = ["Fecha", "Descripción", "Débito", "Crédito"]

    // Cuando: se mapean las columnas
    const mapping = mapColumns(headers)

    // Entonces: los cuatro roles quedan asignados a sus índices
    expect(mapping).not.toBeNull()
    expect(mapping).toMatchObject({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
    })
  })

  it("T-04:mapea sinónimos en inglés", () => {
    // Dado: cabeceras en inglés habituales de un estado de cuenta
    const headers = ["Date", "Description", "Withdrawal", "Deposit"]

    // Cuando: se mapean las columnas
    const mapping = mapColumns(headers)

    // Entonces: se reconocen fecha, descripción, débito y crédito
    expect(mapping).not.toBeNull()
    expect(mapping).toMatchObject({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
    })
  })

  it("T-05:distingue la columna Total del Saldo", () => {
    // Dado: una cabecera con Total (monto) y Saldo (saldo corrido)
    const headers = ["Fecha", "Descripción", "Total", "Saldo"]

    // Cuando: se mapean las columnas
    const mapping = mapColumns(headers)

    // Entonces: amount apunta a Total y balance a Saldo
    expect(mapping).not.toBeNull()
    expect(mapping?.amount).toBe(2)
    expect(mapping?.balance).toBe(3)
    expect(mapping?.amount).not.toBe(mapping?.balance)
  })

  it("T-06:devuelve null y mensaje custom cuando no hay cabecera", () => {
    // Dado: una matriz sin ninguna cabecera reconocible
    const matrix: Matrix = [
      ["foo", "bar"],
      ["1", "2"],
    ]

    // Cuando: se busca cabecera y se parsea con un mensaje propio
    const detection = detectHeader(matrix)
    const result = parseCsv(matrix, { noHeaderMessage: "Formato no reconocido" })

    // Entonces: no hay cabecera, no hay transacciones y se usa el mensaje dado
    expect(detection).toBeNull()
    expect(result.headerRow).toBeNull()
    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toEqual(["Formato no reconocido"])
  })

  it("T-07:no confunde una fila de datos con la cabecera", () => {
    // Dado: una matriz que solo contiene filas de datos
    const matrix: Matrix = [
      ["07/09/2026", "Compra", "500.00"],
      ["08/09/2026", "Venta", "100.00"],
    ]

    // Cuando: se busca la cabecera
    const detection = detectHeader(matrix)

    // Entonces: ninguna fila se considera cabecera
    expect(detection).toBeNull()
  })

  it("T-08:mapea Fecha, Descripción y Monto", () => {
    // Dado: una cabecera mínima con fecha, descripción y monto
    const headers = ["Fecha", "Descripción", "Monto"]

    // Cuando: se mapean las columnas
    const mapping = mapColumns(headers)

    // Entonces: cada rol apunta a su índice
    expect(mapping?.date).toBe(0)
    expect(mapping?.description).toBe(1)
    expect(mapping?.amount).toBe(2)
  })

  it("T-09:devuelve null si la cabecera no tiene fecha", () => {
    // Dado: una cabecera sin ninguna columna de fecha
    const headers = ["Descripción", "Monto"]

    // Cuando: se mapean las columnas
    const mapping = mapColumns(headers)

    // Entonces: el mapeo no es válido
    expect(mapping).toBeNull()
  })
})

describe("montos y tipos", () => {
  it("T-10:interpreta un monto firmado negativo como gasto", () => {
    // Dado: una tabla con columna única de monto y un valor negativo
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "-500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la transacción es un gasto de 500.00
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.transactionType).toBe("expense")
    expect(result.transactions[0]?.amount).toBe("500.00")
  })

  it("T-11:interpreta un monto firmado positivo como ingreso", () => {
    // Dado: una tabla con columna única de monto y un valor positivo
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Venta", "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la transacción es un ingreso de 500.00
    expect(result.errors).toEqual([])
    expect(result.transactions[0]?.transactionType).toBe("income")
    expect(result.transactions[0]?.amount).toBe("500.00")
  })

  it("T-12:usa la columna Débito como gasto", () => {
    // Dado: una tabla débito/crédito con solo el débito completo
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Débito", "Crédito"],
      ["07/09/2026", "Compra", "300.00", ""],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la transacción es un gasto de 300.00
    expect(result.transactions[0]?.transactionType).toBe("expense")
    expect(result.transactions[0]?.amount).toBe("300.00")
  })

  it("T-13:usa la columna Crédito como ingreso", () => {
    // Dado: una tabla débito/crédito con solo el crédito completo
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Débito", "Crédito"],
      ["07/09/2026", "Depósito", "", "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la transacción es un ingreso de 500.00
    expect(result.transactions[0]?.transactionType).toBe("income")
    expect(result.transactions[0]?.amount).toBe("500.00")
  })

  it("T-14:reporta un monto en cero como error y no crea la transacción", () => {
    // Dado: una fila con monto exactamente cero
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "0.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: no hay transacciones y el error indica el monto cero
    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toEqual(["Row 2: amount is zero"])
  })

  it("T-15:reporta cuando débito y crédito están vacíos", () => {
    // Dado: una fila con las dos columnas de monto vacías
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Débito", "Crédito"],
      ["07/09/2026", "Compra", "", ""],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: no hay transacciones y se informa que no hay monto válido
    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toEqual(["Row 2: no valid amount found"])
  })

  it("T-16:la columna Tipo C gana sobre un monto negativo", () => {
    // Dado: un monto negativo con Tipo "C"
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto", "Tipo"],
      ["07/09/2026", "Ajuste", "-500.00", "C"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el tipo de la columna prevalece y es un ingreso
    expect(result.transactions[0]?.transactionType).toBe("income")
    expect(result.transactions[0]?.amount).toBe("500.00")
  })

  it("T-17:la columna Tipo D gana sobre un monto positivo", () => {
    // Dado: un monto positivo con Tipo "D"
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto", "Tipo"],
      ["07/09/2026", "Ajuste", "500.00", "D"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el tipo de la columna prevalece y es un gasto
    expect(result.transactions[0]?.transactionType).toBe("expense")
    expect(result.transactions[0]?.amount).toBe("500.00")
  })

  it("T-18:acepta etiquetas Débito y Crédito en la columna Tipo", () => {
    // Dado: dos filas con signo opuesto y etiquetas completas de tipo
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto", "Tipo"],
      ["07/09/2026", "Compra", "500.00", "Débito"],
      ["08/09/2026", "Venta", "-100.00", "Crédito"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: las etiquetas definen el tipo por encima del signo
    expect(result.transactions[0]?.transactionType).toBe("expense")
    expect(result.transactions[1]?.transactionType).toBe("income")
  })

  it("T-19:interpreta el formato latino 1.234,56", () => {
    // Dado: un monto con punto de miles y coma decimal
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Venta", "1.234,56"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el monto queda en 1234.56
    expect(result.transactions[0]?.amount).toBe("1234.56")
    expect(result.transactions[0]?.transactionType).toBe("income")
  })

  it("T-20:interpreta paréntesis como gasto", () => {
    // Dado: un monto contable negativo entre paréntesis
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "(1,234.56)"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: es un gasto con el monto en positivo
    expect(result.transactions[0]?.transactionType).toBe("expense")
    expect(result.transactions[0]?.amount).toBe("1234.56")
  })
})

describe("fechas y filas", () => {
  it("T-21:resuelve día/mes cuando el archivo tiene 13/02/2026", () => {
    // Dado: un archivo con una fecha que solo puede ser día/mes
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["13/02/2026", "Compra", "100.00"],
      ["01/02/2026", "Venta", "200.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la fecha ambigua se lee como día/mes
    expect(result.dayFirst).toBe(true)
    expect(result.transactions.map((t) => t.transactionDate)).toEqual([
      "2026-02-13",
      "2026-02-01",
    ])
  })

  it("T-22:resuelve mes/día cuando el archivo tiene 02/13/2026", () => {
    // Dado: un archivo con una fecha que solo puede ser mes/día
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["02/13/2026", "Compra", "100.00"],
      ["01/02/2026", "Venta", "200.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la fecha ambigua se lee como mes/día
    expect(result.dayFirst).toBe(false)
    expect(result.transactions.map((t) => t.transactionDate)).toEqual([
      "2026-02-13",
      "2026-01-02",
    ])
  })

  it("T-23:reporta una fecha inválida y omite la fila", () => {
    // Dado: una fila válida y una con el 31 de febrero
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "100.00"],
      ["31/02/2026", "Compra", "200.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: solo queda la fila válida y se informa la fecha inválida
    expect(result.transactions).toHaveLength(1)
    expect(result.errors).toContain(
      'Row 3: invalid date ("31/02/2026")'
    )
  })

  it("T-24:desplaza la numeración de filas con firstRowNumber", () => {
    // Dado: una cabecera precedida por una línea y firstRowNumber 10
    const matrix: Matrix = [
      ["Banco Atlántida"],
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", "Compra", "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix, { firstRowNumber: 10 })

    // Entonces: la cabecera cae en la fila 11 y el dato en la fila 12
    expect(result.headerRow).toBe(2)
    expect(result.transactions[0]?.row).toBe(12)
  })

  it("T-25:ignora una fila completamente vacía sin error", () => {
    // Dado: una cabecera, una fila vacía y una fila con datos
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["", "", ""],
      ["07/09/2026", "Compra", "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la fila vacía no genera transacción ni error
    expect(result.transactions).toHaveLength(1)
    expect(result.errors).toEqual([])
  })

  it("T-26:trunca una descripción larga y avisa", () => {
    // Dado: una descripción de 300 caracteres
    const longDescription = "a".repeat(300)
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto"],
      ["07/09/2026", longDescription, "500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: la descripción queda en 255 caracteres y hay un warning
    expect(result.transactions[0]?.transactionDescription).toHaveLength(255)
    expect(
      result.warnings.some((warning) => warning.includes("truncated"))
    ).toBe(true)
  })
})

describe("saldo", () => {
  it("T-27:valida un saldo corrido ascendente coherente", () => {
    // Dado: dos filas ascendentes donde el saldo suma el movimiento
    const rows = [
      { row: 2, balance: 1000, signed: 0 },
      { row: 3, balance: 1500, signed: 500 },
    ]

    // Cuando: se reconcilias los saldos
    const result = reconcileBalances(rows)

    // Entonces: la comprobación pasa sin warnings
    expect(result.checked).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it("T-28:reporta un saldo corrido incoherente", () => {
    // Dado: dos filas donde el saldo no refleja el movimiento
    const rows = [
      { row: 2, balance: 1000, signed: 0 },
      { row: 3, balance: 1250, signed: 500 },
    ]

    // Cuando: se reconcilian los saldos
    const result = reconcileBalances(rows)

    // Entonces: se marca el mismatch de la fila 3
    expect(result.checked).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain("Row 3")
    expect(result.warnings[0]).toContain("balance mismatch")
  })

  it("T-29:valida un extracto descendente", () => {
    // Dado: un extracto con la fila más nueva primero
    const rows = [
      { row: 2, balance: 1200, signed: 200 },
      { row: 3, balance: 1000, signed: -100 },
    ]

    // Cuando: se reconcilian los saldos
    const result = reconcileBalances(rows)

    // Entonces: se prueba el sentido descendente y no hay warnings
    expect(result.checked).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it("T-30:marca balanceChecked con un saldo coherente en parseTable", () => {
    // Dado: una tabla con columna Saldo que cuadra con los movimientos
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto", "Saldo"],
      ["07/09/2026", "Venta", "500.00", "1500.00"],
      ["08/09/2026", "Compra", "-200.00", "1300.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el saldo se valida sin warnings
    expect(result.balanceChecked).toBe(true)
    expect(
      result.warnings.filter((warning) => warning.includes("balance mismatch"))
    ).toEqual([])
  })

  it("T-31:avisa cuando el saldo de parseTable no cuadra", () => {
    // Dado: una tabla con columna Saldo que no cuadra
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Monto", "Saldo"],
      ["07/09/2026", "Venta", "500.00", "1500.00"],
      ["08/09/2026", "Compra", "-200.00", "1250.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: se reporta el mismatch de saldo
    expect(result.balanceChecked).toBe(true)
    expect(
      result.warnings.some((warning) => warning.includes("balance mismatch"))
    ).toBe(true)
  })
})

describe("utilidades", () => {
  it("T-32:toMatrix normaliza números, null, undefined y espacios", () => {
    // Dado: filas heterogéneas con números, nulos y espacios repetidos
    const rows: unknown[][] = [
      [1234.5, null, undefined],
      ["  Compra   supermercado  "],
      [],
    ]

    // Cuando: se convierten a matriz de strings
    const matrix = toMatrix(rows)

    // Entonces: todo queda como string normalizado
    expect(matrix).toEqual([
      ["1234.5", "", ""],
      ["Compra supermercado"],
      [],
    ])
  })

  it("T-33:mappingToColumnIndexes omite los roles sin mapear", () => {
    // Dado: un mapeo con solo tres roles asignados
    const mapping: ColumnMapping = {
      date: 0,
      description: 1,
      reference: null,
      debit: null,
      credit: null,
      amount: 2,
      balance: null,
      type: null,
    }

    // Cuando: se convierte a índices planos
    const columns = mappingToColumnIndexes(mapping)

    // Entonces: solo aparecen los roles mapeados
    expect(columns).toEqual({ date: 0, description: 1, amount: 2 })
    expect(Object.keys(columns)).not.toContain("balance")
  })

  it("T-34:mappingToColumnIndexes devuelve objeto vacío para null", () => {
    // Dado: un mapeo nulo
    // Cuando: se convierte a índices planos
    // Entonces: no hay columnas
    expect(mappingToColumnIndexes(null)).toEqual({})
  })

  it("T-35:resolveTypeFromLabel reconoce etiquetas de gasto", () => {
    // Dado: etiquetas que representan un débito
    // Cuando: se resuelve el tipo
    // Entonces: todas son gasto
    expect(resolveTypeFromLabel("D")).toBe("expense")
    expect(resolveTypeFromLabel("Débito")).toBe("expense")
    expect(resolveTypeFromLabel("cargo")).toBe("expense")
  })

  it("T-36:resolveTypeFromLabel reconoce etiquetas de ingreso", () => {
    // Dado: etiquetas que representan un crédito
    // Cuando: se resuelve el tipo
    // Entonces: todas son ingreso
    expect(resolveTypeFromLabel("C")).toBe("income")
    expect(resolveTypeFromLabel("Crédito")).toBe("income")
    expect(resolveTypeFromLabel("abono")).toBe("income")
    expect(resolveTypeFromLabel("Depósito")).toBe("income")
  })

  it("T-37:resolveTypeFromLabel devuelve null para etiquetas desconocidas", () => {
    // Dado: etiquetas sin significado de débito/crédito
    // Cuando: se resuelve el tipo
    // Entonces: no se puede determinar
    expect(resolveTypeFromLabel("otro")).toBeNull()
    expect(resolveTypeFromLabel("")).toBeNull()
  })

  it("T-38:normalizeCell colapsa espacios y extremos", () => {
    // Dado: una celda con espacios repetidos alrededor
    // Cuando: se normaliza
    // Entonces: queda un solo espacio interno y sin extremos
    expect(normalizeCell("   Compra    supermercado   ")).toBe(
      "Compra supermercado"
    )
    expect(normalizeCell(undefined)).toBe("")
  })
})

describe("filas de resumen", () => {
  it("T-39:descarta Saldo anterior y Total sin reportar errores", () => {
    // Dado: un extracto con dos movimientos y filas de resumen sin fecha
    const matrix: Matrix = [
      ["Fecha", "Descripci�n", "Monto", "Saldo"],
      ["Saldo anterior", "", "", "1,000.00"],
      ["07/09/2026", "Compra", "-500.00", "500.00"],
      ["08/09/2026", "Salario", "1,500.00", "2,000.00"],
      ["Total del per�odo", "", "", "2,000.00"],
      ["", "Resumen de cuenta", "", ""],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: solo quedan los dos movimientos y ning�n error de fecha
    expect(result.transactions).toHaveLength(2)
    expect(result.errors).toEqual([])
  })

  it("T-40:una fecha inv�lida que no es resumen sigue report�ndose", () => {
    // Dado: una fila con fecha basura (no es una fila de resumen)
    const matrix: Matrix = [
      ["Fecha", "Descripci�n", "Monto"],
      ["07/09/2026", "Compra", "-500.00"],
      ["basura", "Otro", "100.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el error de fecha se conserva
    expect(result.errors).toEqual(['Row 3: invalid date ("basura")'])
  })
})

describe("columnas combinadas", () => {
  it("T-41:trata una columna Débito/Crédito como monto firmado", () => {
    // Dado: una sola columna que sirve para débitos y créditos
    const matrix: Matrix = [
      ["Fecha", "Descripción", "Débito/Crédito"],
      ["07/09/2026", "Compra", "-500.00"],
      ["08/09/2026", "Salario", "1,500.00"],
    ]

    // Cuando: se parsea la tabla
    const result = parseCsv(matrix)

    // Entonces: el signo define el tipo y el monto se guarda positivo
    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      transactionType: "expense",
      amount: "500.00",
    })
    expect(result.transactions[1]).toMatchObject({
      transactionType: "income",
      amount: "1500.00",
    })
  })
})