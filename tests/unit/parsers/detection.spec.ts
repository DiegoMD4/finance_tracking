import { describe, expect, it } from "vitest"

import {
  detectBank,
  detectCurrencyFromText,
  resolveFileFormat,
  sniffFormatFromBytes,
} from "@/lib/parsers/core/detection"

const bytes = (values: number[]): ArrayBuffer =>
  new Uint8Array(values).buffer as ArrayBuffer

const textBytes = (value: string): ArrayBuffer =>
  new TextEncoder().encode(value).buffer as ArrayBuffer

describe("sniffFormatFromBytes", () => {
  it("D-01:detecta PDF por su firma", () => {
    // Dado: un buffer que empieza con %PDF
    const buffer = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])

    // Cuando: se inspecciona el contenido
    // Entonces: el formato es pdf
    expect(sniffFormatFromBytes(buffer)).toBe("pdf")
  })

  it("D-02:detecta XLSX por la firma ZIP", () => {
    expect(sniffFormatFromBytes(bytes([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(
      "excel"
    )
  })

  it("D-03:detecta el .xls antiguo por la firma OLE", () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    expect(sniffFormatFromBytes(bytes(ole))).toBe("excel")
  })

  it("D-04:trata el texto plano como CSV", () => {
    expect(sniffFormatFromBytes(textBytes("fecha,descripcion,monto\n"))).toBe(
      "csv"
    )
  })

  it("D-05:reconoce HTML exportado como Excel", () => {
    const html = "<html><body><table><tr><td>Fecha</td></tr></table></body></html>"
    expect(sniffFormatFromBytes(textBytes(html))).toBe("excel")
  })

  it("D-06:devuelve unknown para contenido binario", () => {
    expect(sniffFormatFromBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]))).toBe(
      "unknown"
    )
  })

  it("D-07:devuelve unknown para un buffer vacío", () => {
    expect(sniffFormatFromBytes(new ArrayBuffer(0))).toBe("unknown")
  })
})

describe("resolveFileFormat", () => {
  it("D-08:descarta imágenes aunque su contenido parezca texto", () => {
    // Dado: un .png con texto ASCII adentro
    // Cuando: se resuelve el formato
    // Entonces: no se intenta parsear como CSV
    expect(resolveFileFormat("foto.png", textBytes("contenido"))).toBe(
      "unknown"
    )
  })

  it("D-09:las firmas binarias mandan sobre la extensión", () => {
    // Dado: un PDF con extensión .csv
    const pdf = bytes([0x25, 0x50, 0x44, 0x46, 0x2d])

    // Entonces: se parsea como PDF
    expect(resolveFileFormat("estado.csv", pdf)).toBe("pdf")
  })

  it("D-10:usa la extensión cuando el contenido no es reconocible", () => {
    expect(resolveFileFormat("estado.xlsx", new ArrayBuffer(0))).toBe("excel")
    expect(resolveFileFormat("estado.pdf", new ArrayBuffer(0))).toBe("pdf")
  })

  it("D-11:acepta .txt tabulado como CSV", () => {
    expect(resolveFileFormat("movimientos.txt", textBytes("a\tb\nc\td"))).toBe(
      "csv"
    )
  })

  it("D-12:devuelve unknown sin extensión ni contenido reconocible", () => {
    expect(resolveFileFormat("archivo", new ArrayBuffer(0))).toBe("unknown")
  })
})

describe("detectBank", () => {
  it("D-13:detecta Banco Atlántida con acentos", () => {
    const text = "Estado de Cuenta Banco Atlántida, cuenta de ahorro"
    expect(detectBank(text)).toBe("Banco Atlántida")
  })

  it("D-14:detecta Ficohsa y BAC Credomatic", () => {
    expect(detectBank("BANCO FICOHSA MOVIMIENTOS")).toBe("Banco Ficohsa")
    expect(detectBank("BAC Credomatic tarjeta de crédito")).toBe(
      "BAC Credomatic"
    )
  })

  it("D-15:devuelve null cuando no hay firma conocida", () => {
    expect(detectBank("Estado de cuenta sin marca")).toBeNull()
    expect(detectBank("")).toBeNull()
  })
})

describe("detectCurrencyFromText", () => {
  it("D-16:detecta lempiras por el símbolo L", () => {
    const text = "Saldo anterior L 1,500.00\nCompra L 200.00"
    expect(detectCurrencyFromText(text)).toBe("HNL")
  })

  it("D-17:detecta dólares por código y por símbolo", () => {
    expect(detectCurrencyFromText("Total USD 100.00")).toBe("USD")
    expect(detectCurrencyFromText("Pago $ 50.00")).toBe("USD")
  })

  it("D-18:devuelve null sin evidencia o con empate", () => {
    expect(detectCurrencyFromText("Estado de cuenta")).toBeNull()
    expect(detectCurrencyFromText("L 100 USD")).toBeNull()
  })
})
