import { describe, expect, it } from "vitest"

import { extractTransactions } from "@/lib/parsers/file-extractor"

const CSV_MIME = "text/csv"

function csvFile(content: string, name = "estado.csv"): File {
  return new File([content], name, { type: CSV_MIME })
}

const twoIdenticalRows = [
  "Fecha;Descripción;Débito;Crédito;Saldo",
  "07/09/2026;COMPRA POS;500,00;;1500,00",
  "07/09/2026;COMPRA POS;500,00;;1000,00",
].join("\n")

const twoDifferentRows = [
  "Fecha;Descripción;Débito;Crédito;Saldo",
  "07/09/2026;COMPRA POS;500,00;;1500,00",
  "08/09/2026;SALARIO;;1000,00;2500,00",
].join("\n")

describe("extractTransactions: snapshot de identidad", () => {
  it("congela los valores parseados en cada fila", async () => {
    // Dado: un CSV con una fila de débito
    const file = csvFile(twoDifferentRows)

    // Cuando: se extraen las transacciones con una moneda de respaldo
    const result = await extractTransactions(file, { currency: "HNL" })

    // Entonces: cada fila lleva su snapshot original
    expect(result.transactions[0].dedupe).toEqual({
      original: {
        date: "2026-09-07",
        amount: "500.00",
        type: "expense",
        reference: null,
        description: "COMPRA POS",
        currency: "HNL",
      },
      occurrence: 1,
    })
    expect(result.transactions[1].dedupe).toEqual({
      original: {
        date: "2026-09-08",
        amount: "1000.00",
        type: "income",
        reference: null,
        description: "SALARIO",
        currency: "HNL",
      },
      occurrence: 1,
    })
  })

  it("numera las copias idénticas dentro del archivo", async () => {
    // Dado: un archivo con dos movimientos idénticos (mismo día, monto y texto)
    const file = csvFile(twoIdenticalRows)

    // Cuando: se extraen
    const result = await extractTransactions(file, { currency: "HNL" })

    // Entonces: son la ocurrencia 1 y 2 del mismo movimiento
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions.map((tx) => tx.dedupe?.occurrence)).toEqual([
      1, 2,
    ])
  })

  it("no numera entre sí movimientos distintos", async () => {
    const file = csvFile(twoDifferentRows)

    const result = await extractTransactions(file, { currency: "HNL" })

    expect(result.transactions.map((tx) => tx.dedupe?.occurrence)).toEqual([
      1, 1,
    ])
  })

  it("deja un snapshot al que apunta el archivo, no al formulario", async () => {
    // Dado: el mismo archivo extraído con dos monedas distintas
    const first = await extractTransactions(csvFile(twoDifferentRows), {
      currency: "HNL",
    })
    const second = await extractTransactions(csvFile(twoDifferentRows), {
      currency: "USD",
    })

    // Entonces: la moneda queda dentro del snapshot en cada caso
    expect(first.transactions[0].dedupe?.original.currency).toBe("HNL")
    expect(second.transactions[0].dedupe?.original.currency).toBe("USD")
  })

  it("no agrega snapshot cuando no hay transacciones", async () => {
    const file = csvFile("totalmente irreconocible", "basura.csv")

    const result = await extractTransactions(file)

    expect(result.transactions).toEqual([])
  })
})
