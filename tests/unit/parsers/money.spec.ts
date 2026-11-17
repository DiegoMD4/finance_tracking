import { describe, expect, it } from "vitest"
import {
  amountToPositiveString,
  formatAmount,
  looksLikeAmount,
  parseAmount,
} from "@/lib/parsers/core/money"

describe("parseAmount: separadores de miles y decimales", () => {
  it("interpreta 1.234,56 con coma decimal y punto de miles", () => {
    // Dado: un monto en formato europeo
    const raw = "1.234,56"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el punto se descarta y la coma pasa a ser el decimal
    expect(result).toMatchObject({
      value: 1234.56,
      negative: false,
      currency: null,
    })
  })

  it("interpreta 1,234.56 con coma de miles y punto decimal", () => {
    // Dado: un monto en formato anglosajón
    const raw = "1,234.56"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la coma se descarta y el punto queda como decimal
    expect(result).toMatchObject({
      value: 1234.56,
      negative: false,
      currency: null,
    })
  })

  it("quita todos los separadores de miles de 1,234,567.89", () => {
    // Dado: un monto con dos separadores de miles
    const raw = "1,234,567.89"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el valor conserva solo el punto decimal
    expect(result).toMatchObject({ value: 1234567.89 })
  })

  it("trata 1.234.567 como miles sin decimales", () => {
    // Dado: un monto con dos puntos y sin coma
    const raw = "1.234.567"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: todos los puntos se interpretan como miles
    expect(result).toMatchObject({ value: 1234567 })
  })

  it("asume que 1.234 son miles por la heurística de tres dígitos", () => {
    // Dado: un monto con un único punto y tres dígitos a la derecha
    const raw = "1.234"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se interpreta como mil doscientos treinta y cuatro
    expect(result).toMatchObject({ value: 1234 })
  })

  it("interpreta 1,50 como decimal por tener dos dígitos a la derecha", () => {
    // Dado: un monto con coma y dos dígitos finales
    const raw = "1,50"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la coma es decimal
    expect(result).toMatchObject({ value: 1.5 })
  })

  it("interpreta 12,345 como miles", () => {
    // Dado: un monto con tres dígitos a la derecha y una parte entera corta
    const raw = "12,345"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la coma es separador de miles
    expect(result).toMatchObject({ value: 12345 })
  })

  it("mantiene el cero cuando el monto es 0,00", () => {
    // Dado: un monto nulo escrito con coma decimal
    const raw = "0,00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el valor es cero y no es negativo
    expect(result).toMatchObject({ value: 0, negative: false })
    expect(result.value).toBe(0)
  })

  it("interpreta 0.500 como medio punto", () => {
    // Dado: un monto con parte entera cero y tres decimales
    const raw = "0.500"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no se aplica la heurística de miles porque la parte entera es 0
    expect(result).toMatchObject({ value: 0.5 })
  })

  it("redondea a dos decimales los montos con más precisión", () => {
    // Dado: un monto con tres decimales
    const raw = "1,234.567"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el valor se redondea a dos decimales
    expect(result).toMatchObject({ value: 1234.57 })
  })
})

describe("parseAmount: negativos contables", () => {
  it("reconoce el negativo entre paréntesis", () => {
    // Dado: un monto contable negativo entre paréntesis
    const raw = "(1,234.56)"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el valor es negativo y se marca la bandera
    expect(result).toMatchObject({
      value: -1234.56,
      negative: true,
      currency: null,
    })
  })

  it("reconoce el signo menos al final del monto", () => {
    // Dado: un monto con el menos como sufijo
    const raw = "500.00-"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el valor queda en negativo
    expect(result).toMatchObject({ value: -500, negative: true })
  })

  it("normaliza el signo menos unicode U+2212", () => {
    // Dado: un monto con el signo menos matemático (U+2212)
    const raw = "−500.00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se trata como un menos ASCII
    expect(result).toMatchObject({ value: -500, negative: true })
  })

  it("normaliza el guion largo (en dash) como signo negativo", () => {
    // Dado: un monto con en dash delante del número
    const raw = "–500"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se trata como un menos ASCII
    expect(result).toMatchObject({ value: -500, negative: true })
  })

  it("acepta el menos separado por un espacio", () => {
    // Dado: un monto con menos, espacio y coma decimal
    const raw = "- 500,00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: el signo se conserva y la coma es decimal
    expect(result).toMatchObject({ value: -500, negative: true })
  })

  it("neutraliza el signo de -0.00", () => {
    // Dado: un cero escrito con signo negativo
    const raw = "-0.00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no debe quedar ni -0 ni la bandera de negativo
    expect(result.negative).toBe(false)
    expect(result.value).toBe(0)
  })

  it("no marca como negativo un monto positivo", () => {
    // Dado: un monto positivo sin signo
    const raw = "500.00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la bandera de negativo queda en false
    expect(result).toMatchObject({
      value: 500,
      negative: false,
      currency: null,
    })
  })
})

describe("parseAmount: detección de moneda", () => {
  it("detecta HNL con el prefijo L", () => {
    // Dado: un monto con el símbolo de lempira y coma de miles
    const raw = "L 3,300.00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la moneda es HNL y el monto se interpreta completo
    expect(result).toMatchObject({
      value: 3300,
      currency: "HNL",
      negative: false,
    })
  })

  it("detecta HNL con el código ISO", () => {
    // Dado: un monto con el código ISO de lempira
    const raw = "HNL 3,300.00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce HNL
    expect(result).toMatchObject({ value: 3300, currency: "HNL" })
  })

  it("detecta HNL en L. 500 y descarta el punto del símbolo", () => {
    // Dado: el símbolo de lempira escrito con punto
    const raw = "L. 500"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce HNL y el punto no debe afectar el monto
    expect(result).toMatchObject({ value: 500, currency: "HNL" })
  })

  it("detecta GTQ con el prefijo Q", () => {
    // Dado: un monto con el símbolo de quetzal
    const raw = "Q 300"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la moneda es GTQ
    expect(result).toMatchObject({ value: 300, currency: "GTQ" })
  })

  it("detecta GTQ con el código ISO", () => {
    // Dado: un monto con el código ISO de quetzal
    const raw = "GTQ 300"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce GTQ
    expect(result).toMatchObject({ value: 300, currency: "GTQ" })
  })

  it("detecta CRC con el símbolo de colón ₡", () => {
    // Dado: un monto costarricense con punto de miles y coma decimal
    const raw = "₡ 1.500,00"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la moneda es CRC y el monto es mil quinientos
    expect(result).toMatchObject({ value: 1500, currency: "CRC" })
  })

  it("detecta USD con el símbolo $", () => {
    // Dado: un monto con el símbolo de dólar pegado al número
    const raw = "$1,234.56"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la moneda es USD
    expect(result).toMatchObject({ value: 1234.56, currency: "USD" })
  })

  it("detecta USD con el prefijo US$", () => {
    // Dado: un monto con el prefijo US$
    const raw = "US$ 1,234.56"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce USD
    expect(result).toMatchObject({ value: 1234.56, currency: "USD" })
  })

  it("detecta USD con el código ISO", () => {
    // Dado: un monto con el código ISO de dólar
    const raw = "USD 10"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce USD
    expect(result).toMatchObject({ value: 10, currency: "USD" })
  })

  it("detecta EUR con el símbolo €", () => {
    // Dado: un monto europeo con punto de miles y coma decimal
    const raw = "€ 1.234,56"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: la moneda es EUR
    expect(result).toMatchObject({ value: 1234.56, currency: "EUR" })
  })

  it("detecta NIO con el prefijo C$", () => {
    // Dado: un monto con el símbolo de córdoba
    const raw = "C$ 100"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce NIO y no el $ genérico
    expect(result).toMatchObject({ value: 100, currency: "NIO" })
  })

  it("detecta DOP con el prefijo RD$", () => {
    // Dado: un monto con el símbolo de peso dominicano
    const raw = "RD$ 100"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce DOP y no el $ genérico
    expect(result).toMatchObject({ value: 100, currency: "DOP" })
  })

  it("detecta PEN con el prefijo S/", () => {
    // Dado: un monto con el símbolo de sol peruano
    const raw = "S/ 100"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce PEN
    expect(result).toMatchObject({ value: 100, currency: "PEN" })
  })

  it("detecta MXN con el prefijo MX$", () => {
    // Dado: un monto con el símbolo de peso mexicano
    const raw = "MX$ 100"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: se reconoce MXN y no el $ genérico
    expect(result).toMatchObject({ value: 100, currency: "MXN" })
  })

  it("usa la moneda por defecto cuando el texto no la incluye", () => {
    // Dado: un monto sin símbolo y una moneda por defecto
    const raw = "100"

    // Cuando: se parsea con la opción currency
    const result = parseAmount(raw, { currency: "USD" })

    // Entonces: se usa la moneda por defecto
    expect(result).toMatchObject({ value: 100, currency: "USD" })
  })

  it("prioriza la moneda detectada sobre la moneda por defecto", () => {
    // Dado: un texto con símbolo $ y una moneda por defecto distinta
    const raw = "$ 100"

    // Cuando: se parsea con currency EUR
    const result = parseAmount(raw, { currency: "EUR" })

    // Entonces: gana la moneda encontrada en el texto
    expect(result).toMatchObject({ value: 100, currency: "USD" })
  })

  it("devuelve currency null cuando no hay símbolo ni opción", () => {
    // Dado: un texto numérico sin símbolo de moneda
    const raw = "100"

    // Cuando: se parsea sin opciones
    const result = parseAmount(raw)

    // Entonces: no se inventa una moneda
    expect(result).toMatchObject({ currency: null })
  })
})

describe("parseAmount: separador decimal forzado", () => {
  // Nota: el hint indica qué carácter es el decimal y cuál el de miles, así
  // que con "," el punto se descarta como miles ("1.234" => 1234) y con "."
  // la coma se descarta como miles ("1,234" => 1234). La documentación
  // original sugería 1.23 en esos casos, pero el comportamiento real es 1234;
  // los asserts reflejan el resultado comprobado.

  it("fuerza coma decimal y descarta el punto como miles", () => {
    // Dado: "1.234" con separador decimal forzado a coma
    const raw = "1.234"

    // Cuando: se parsea con decimalSeparator ","
    const result = parseAmount(raw, { decimalSeparator: "," })

    // Entonces: el punto se interpreta como separador de miles
    expect(result).toMatchObject({ value: 1234 })
  })

  it("interpreta la coma como decimal con decimalSeparator ','", () => {
    // Dado: "1,5" con separador decimal forzado a coma
    const raw = "1,5"

    // Cuando: se parsea con decimalSeparator ","
    const result = parseAmount(raw, { decimalSeparator: "," })

    // Entonces: la coma es decimal
    expect(result).toMatchObject({ value: 1.5 })
  })

  it("resuelve 1.234,56 con decimalSeparator ','", () => {
    // Dado: un monto europeo con el separador decimal forzado a coma
    const raw = "1.234,56"

    // Cuando: se parsea con decimalSeparator ","
    const result = parseAmount(raw, { decimalSeparator: "," })

    // Entonces: el punto se descarta y la coma queda como decimal
    expect(result).toMatchObject({ value: 1234.56 })
  })

  it("fuerza punto decimal y descarta la coma como miles", () => {
    // Dado: "1,234" con separador decimal forzado a punto
    const raw = "1,234"

    // Cuando: se parsea con decimalSeparator "."
    const result = parseAmount(raw, { decimalSeparator: "." })

    // Entonces: la coma se interpreta como separador de miles
    expect(result).toMatchObject({ value: 1234 })
  })

  it("resuelve 1,234.56 con decimalSeparator '.'", () => {
    // Dado: un monto anglosajón con el separador decimal forzado a punto
    const raw = "1,234.56"

    // Cuando: se parsea con decimalSeparator "."
    const result = parseAmount(raw, { decimalSeparator: "." })

    // Entonces: la coma se descarta y el punto queda como decimal
    expect(result).toMatchObject({ value: 1234.56 })
  })
})

describe("parseAmount: entradas sin número", () => {
  it("devuelve null para la cadena vacía", () => {
    // Dado: un texto vacío
    const raw = ""

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no hay monto ni negativo
    expect(result).toMatchObject({
      value: null,
      negative: false,
      currency: null,
    })
  })

  it("devuelve null para un guion suelto", () => {
    // Dado: un texto que solo contiene un menos
    const raw = "-"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no hay dígitos y no se marca negativo
    expect(result).toMatchObject({ value: null, negative: false })
  })

  it("devuelve null para texto sin dígitos", () => {
    // Dado: una palabra sin números
    const raw = "abc"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no se detecta monto
    expect(result).toMatchObject({ value: null, negative: false })
  })

  it("devuelve null para paréntesis vacíos", () => {
    // Dado: paréntesis con un espacio y sin dígitos
    const raw = "( )"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: no se activa la regla de negativos ni hay monto
    expect(result).toMatchObject({ value: null, negative: false })
  })

  it("conserva la moneda por defecto aunque no haya monto", () => {
    // Dado: un texto vacío y una moneda por defecto
    const raw = ""

    // Cuando: se parsea con currency HNL
    const result = parseAmount(raw, { currency: "HNL" })

    // Entonces: el monto es null pero la moneda se mantiene
    expect(result).toMatchObject({
      value: null,
      negative: false,
      currency: "HNL",
    })
  })
})

describe("parseAmount: metadatos", () => {
  it("devuelve el texto original sin recortar ni normalizar", () => {
    // Dado: un monto con espacios alrededor y coma de miles
    const raw = "  L 3,300.00  "

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: raw conserva exactamente el texto recibido
    expect(result.raw).toBe(raw)
    expect(result).toMatchObject({ value: 3300, currency: "HNL" })
  })

  it("conserva el texto original en un negativo contable", () => {
    // Dado: un negativo entre paréntesis
    const raw = "(1,234.56)"

    // Cuando: se parsea
    const result = parseAmount(raw)

    // Entonces: raw no se reemplaza por el valor normalizado
    expect(result.raw).toBe(raw)
  })
})

describe("formatAmount", () => {
  it("formatea con dos decimales", () => {
    // Dado: un valor con un decimal
    // Cuando: se formatea
    // Entonces: se agrega el cero final
    expect(formatAmount(1234.5)).toBe("1234.50")
  })

  it("formatea null como 0.00", () => {
    // Dado: un valor nulo
    // Cuando: se formatea
    // Entonces: se muestra como cero
    expect(formatAmount(null)).toBe("0.00")
  })

  it("normaliza a 0.00 los valores menores a medio centavo", () => {
    // Dado: un valor negativo prácticamente cero
    // Cuando: se formatea
    // Entonces: no aparece -0.00
    expect(formatAmount(-0.001)).toBe("0.00")
  })

  it("conserva el signo de los negativos", () => {
    // Dado: un valor negativo
    // Cuando: se formatea
    // Entonces: se mantiene el signo y los dos decimales
    expect(formatAmount(-500)).toBe("-500.00")
  })

  it("formatea el cero sin signo", () => {
    // Dado: el valor cero
    // Cuando: se formatea
    // Entonces: se muestra 0.00
    expect(formatAmount(0)).toBe("0.00")
  })
})

describe("amountToPositiveString", () => {
  it("convierte un valor negativo en su absoluto formateado", () => {
    // Dado: un valor negativo
    // Cuando: se convierte a string positivo
    // Entonces: se pierde el signo y se agregan dos decimales
    expect(amountToPositiveString(-500)).toBe("500.00")
  })

  it("convierte null en 0.00", () => {
    // Dado: un valor nulo
    // Cuando: se convierte a string positivo
    // Entonces: se muestra como cero
    expect(amountToPositiveString(null)).toBe("0.00")
  })

  it("formatea un valor positivo con dos decimales", () => {
    // Dado: un valor positivo con un decimal
    // Cuando: se convierte a string positivo
    // Entonces: se agrega el cero final
    expect(amountToPositiveString(1234.5)).toBe("1234.50")
  })
})

describe("looksLikeAmount", () => {
  it("detecta un monto con moneda y separadores", () => {
    // Dado: un texto con dígitos, moneda y separadores
    const raw = "L 3,300.00"

    // Cuando: se evalúa
    // Entonces: se considera un monto
    expect(looksLikeAmount(raw)).toBe(true)
  })

  it("rechaza texto sin dígitos", () => {
    // Dado: una palabra sin números
    const raw = "abc"

    // Cuando: se evalúa
    // Entonces: no se considera un monto
    expect(looksLikeAmount(raw)).toBe(false)
  })

  it("rechaza la cadena vacía", () => {
    // Dado: un texto vacío
    const raw = ""

    // Cuando: se evalúa
    // Entonces: no se considera un monto
    expect(looksLikeAmount(raw)).toBe(false)
  })

  it("rechaza un guion suelto", () => {
    // Dado: un menos sin dígitos
    const raw = "-"

    // Cuando: se evalúa
    // Entonces: no se considera un monto
    expect(looksLikeAmount(raw)).toBe(false)
  })
})
