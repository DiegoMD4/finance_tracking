import { afterEach, describe, expect, it, vi } from "vitest"
import {
  decodeBytes,
  looksLikeText,
  normalizeText,
  stripSepLine,
} from "@/lib/parsers/core/text"

/** Construye un ArrayBuffer a partir de bytes crudos, sin usar Buffer. */
function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("decodeBytes", () => {
  it("T-01:decodifica UTF-8 con acentos sin BOM", () => {
    // Dado: un buffer UTF-8 con acentos y sin BOM
    const buffer = bytes(...utf8Bytes("Descripción del débito"))

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: el texto se conserva y se informa UTF-8 sin BOM
    expect(result.text).toBe("Descripción del débito")
    expect(result.encoding).toBe("utf-8")
    expect(result.hadBom).toBe(false)
  })

  it("T-02:quita el BOM UTF-8 y marca hadBom", () => {
    // Dado: un buffer UTF-8 que arranca con BOM (EF BB BF)
    const buffer = bytes(0xef, 0xbb, 0xbf, ...utf8Bytes("Descripción"))

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: el BOM no queda en el texto pero se reporta
    expect(result.text).toBe("Descripción")
    expect(result.encoding).toBe("utf-8")
    expect(result.hadBom).toBe(true)
    expect(result.text.charCodeAt(0)).not.toBe(0xfeff)
  })

  it("T-03:decodifica CP1252 cuando el UTF-8 es inválido", () => {
    // Dado: "Descripción" en CP1252 real (0xF3 = ó)
    const buffer = bytes(
      0x44,
      0x65,
      0x73,
      0x63,
      0x72,
      0x69,
      0x70,
      0x63,
      0x69,
      0xf3,
      0x6e
    )

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: se reinterpreta como windows-1252 y no queda mojibake
    expect(result.text).toBe("Descripción")
    expect(result.encoding).toBe("windows-1252")
    expect(result.hadBom).toBe(false)
  })

  it("T-04:decodifica CP1252 con 0xED (í)", () => {
    // Dado: "día" en CP1252 (0xED = í), inválido como UTF-8
    const buffer = bytes(0x64, 0xed, 0x61)

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: la í se reconstruye correctamente
    expect(result.text).toBe("día")
    expect(result.encoding).toBe("windows-1252")
  })

  it("T-05:decodifica UTF-16LE con BOM", () => {
    // Dado: "Hola" en UTF-16LE precedido por el BOM FF FE
    const buffer = bytes(
      0xff,
      0xfe,
      0x48,
      0x00,
      0x6f,
      0x00,
      0x6c,
      0x00,
      0x61,
      0x00
    )

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: se usa UTF-16LE y se reporta el BOM
    expect(result.text).toBe("Hola")
    expect(result.encoding).toBe("utf-16le")
    expect(result.hadBom).toBe(true)
  })

  it("T-06:decodifica UTF-16BE con BOM", () => {
    // Dado: "Hola" en UTF-16BE precedido por el BOM FE FF
    const buffer = bytes(
      0xfe,
      0xff,
      0x00,
      0x48,
      0x00,
      0x6f,
      0x00,
      0x6c,
      0x00,
      0x61
    )

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: se usa UTF-16BE
    expect(result.text).toBe("Hola")
    expect(result.encoding).toBe("utf-16be")
    expect(result.hadBom).toBe(true)
  })

  it("T-07:no rompe con un buffer vacío", () => {
    // Dado: un ArrayBuffer de 0 bytes
    const result = decodeBytes(new ArrayBuffer(0))

    // Cuando/Entonces: devuelve texto vacío como UTF-8 sin BOM
    expect(result).toEqual({ text: "", encoding: "utf-8", hadBom: false })
  })

  it("T-08:usa el fallback propia si no existe TextDecoder (UTF-8)", () => {
    // Dado: un entorno sin TextDecoder y un buffer UTF-8 con acentos
    vi.stubGlobal("TextDecoder", undefined)
    const buffer = bytes(...utf8Bytes("Descripción"))

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: el decodificador manual reconstruye el texto
    expect(result.text).toBe("Descripción")
    expect(result.encoding).toBe("utf-8")
  })

  it("T-09:usa el fallback propia si no existe TextDecoder (CP1252)", () => {
    // Dado: un entorno sin TextDecoder y bytes CP1252 con 0xF3 y 0xED
    vi.stubGlobal("TextDecoder", undefined)
    const buffer = bytes(0x64, 0xed, 0x61, 0x20, 0x2d, 0x20, 0xf3)

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: la tabla manual mapea ambos bytes correctamente
    expect(result.text).toBe("día - ó")
    expect(result.encoding).toBe("windows-1252")
  })

  it("T-10:el fallback aplica la tabla CP1252 de 0x80-0x9F", () => {
    // Dado: comillas curvas CP1252 (0x93 y 0x94) sin TextDecoder
    vi.stubGlobal("TextDecoder", undefined)
    const buffer = bytes(0x93, 0x48, 0x6f, 0x6c, 0x61, 0x94)

    // Cuando: se decodifica
    const result = decodeBytes(buffer)

    // Entonces: se decodifican como “ y ” y normalizeText las pasa a ASCII
    expect(result.text).toBe('"Hola"')
    expect(result.encoding).toBe("windows-1252")
  })
})

describe("normalizeText", () => {
  it("T-11:unifica signos, NBSP, saltos de línea y espacios", () => {
    // Dado: un texto con signos tipográficos, NBSP, CRLF y espacios múltiples
    const input = "Saldo\u00A0\u00A0−1.000 – 500\t\t— 25\r\nTotal"

    // Cuando: se normaliza
    const result = normalizeText(input)

    // Entonces: todo queda ASCII, con LF y un solo espacio
    expect(result).toBe("Saldo -1.000 - 500 - 25\nTotal")
  })

  it("T-12:convierte CR suelto a LF y comillas curvas a rectas", () => {
    // Dado: un texto con CR aislado y comillas tipográficas
    const input = "“Movimiento”\r’débito’"

    // Cuando: se normaliza
    const result = normalizeText(input)

    // Entonces: los saltos y comillas quedan en ASCII
    expect(result).toBe('"Movimiento"\n\'débito\'')
  })

  it("T-13:conserva líneas vacías intermedias y quita las finales", () => {
    // Dado: un texto con un bloque separado por una línea vacía y basura final
    const input = "Encabezado\n\nMovimiento 1  \nMovimiento 2\n\n\n"

    // Cuando: se normaliza
    const result = normalizeText(input)

    // Entonces: la línea vacía intermedia se conserva y las finales no
    expect(result).toBe("Encabezado\n\nMovimiento 1\nMovimiento 2")
  })

  it("T-14:elimina BOM y caracteres de ancho cero", () => {
    // Dado: un texto con BOM/ZWNBSP, ZWSP, ZWNJ y ZWJ
    const input = "\uFEFFDescripción\u200B de\u200C mov\u200Dimiento"

    // Cuando: se normaliza
    const result = normalizeText(input)

    // Entonces: los caracteres invisibles desaparecen
    expect(result).toBe("Descripción de movimiento")
  })

  it("T-15:no altera acentos ni mayúsculas", () => {
    // Dado: un texto con acentos, ñ y mayúsculas
    const input = "DÉBITO Crédito Año"

    // Cuando: se normaliza
    const result = normalizeText(input)

    // Entonces: se conserva tal cual (el matcheo se hace en otros módulos)
    expect(result).toBe("DÉBITO Crédito Año")
  })

  it("T-16:devuelve string vacío para texto vacío", () => {
    expect(normalizeText("")).toBe("")
    expect(normalizeText("   \n\t\n  ")).toBe("")
  })
})

describe("stripSepLine", () => {
  it("T-17:quita la línea sep=; y devuelve el delimitador", () => {
    // Dado: un CSV exportado por Excel con la directiva sep
    const input = "sep=;\nfecha;descripcion;monto\n07/09/2026;Compra;500"

    // Cuando: se quita la directiva
    const result = stripSepLine(input)

    // Entonces: el texto arranca en la cabecera y se informa el delimitador
    expect(result.delimiter).toBe(";")
    expect(result.text).toBe("fecha;descripcion;monto\n07/09/2026;Compra;500")
  })

  it("T-18:devuelve null cuando no hay línea sep", () => {
    // Dado: un CSV normal sin directiva
    const input = "fecha,descripcion,monto\n07/09/2026,Compra,500"

    // Cuando: se intenta quitar la directiva
    const result = stripSepLine(input)

    // Entonces: el texto queda intacto y no hay delimitador
    expect(result.delimiter).toBeNull()
    expect(result.text).toBe(input)
  })

  it("T-19:acepta tab como delimitador y espacios alrededor del =", () => {
    // Dado: una directiva con tab y espacios
    const input = "sep = \t\ncol1\tcol2"

    // Cuando: se quita la directiva
    const result = stripSepLine(input)

    // Entonces: el delimitador es el tab
    expect(result.delimiter).toBe("\t")
    expect(result.text).toBe("col1\tcol2")
  })

  it("T-20:ignora líneas vacías iniciales al buscar el sep", () => {
    // Dado: un texto que arranca con una línea vacía y luego la directiva
    const input = "\nsep=|\na|b"

    // Cuando: se quita la directiva
    const result = stripSepLine(input)

    // Entonces: se detecta igual y solo se elimina la línea del sep
    expect(result.delimiter).toBe("|")
    expect(result.text).toBe("\na|b")
  })
})

describe("looksLikeText", () => {
  it("T-21:devuelve true para un CSV simple", () => {
    // Dado: un CSV con acentos y saltos de línea
    const buffer = bytes(...utf8Bytes("fecha,descripción,monto\n07/09/2026,Compra,-500"))

    // Cuando: se evalúa la heurística
    const result = looksLikeText(buffer)

    // Entonces: se considera texto plano
    expect(result).toBe(true)
  })

  it("T-22:devuelve false si hay bytes NUL", () => {
    // Dado: un buffer con bytes NUL (típico de binarios)
    const buffer = bytes(0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x61)

    // Cuando/Entonces: no parece texto
    expect(looksLikeText(buffer)).toBe(false)
  })

  it("T-23:devuelve false para un BOM UTF-16", () => {
    // Dado: un buffer que arranca con BOM UTF-16LE
    const buffer = bytes(0xff, 0xfe, 0x48, 0x00)

    // Cuando/Entonces: se descarta como texto plano
    expect(looksLikeText(buffer)).toBe(false)
  })

  it("T-24:devuelve false si hay demasiados bytes de control", () => {
    // Dado: un buffer mayormente imprimible pero con >5% de controles
    const buffer = bytes(
      0x61,
      0x62,
      0x63,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07
    )

    // Cuando/Entonces: la proporción de controles lo descarta
    expect(looksLikeText(buffer)).toBe(false)
  })

  it("T-25:devuelve true para un buffer vacío", () => {
    expect(looksLikeText(new ArrayBuffer(0))).toBe(true)
  })
})
