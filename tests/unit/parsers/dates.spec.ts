import { describe, expect, it } from "vitest"
import {
  isValidIsoDate,
  parseDate,
  resolveDayFirst,
} from "@/lib/parsers/core/dates"

describe("parseDate: formatos con año primero", () => {
  it("convierte una fecha ISO simple", () => {
    // Dado: una fecha en formato YYYY-MM-DD
    const raw = "2026-09-07"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se conserva el ISO con confianza alta
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("acepta barras como separador con año primero", () => {
    // Dado: una fecha YYYY/MM/DD
    const raw = "2026/09/07"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se normaliza a guiones
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("reconoce el mes abreviado en inglés", () => {
    // Dado: una fecha con mes abreviado
    const raw = "2026-Sep-07"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el mes se resuelve a septiembre
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("reconoce el mes completo en español", () => {
    // Dado: una fecha con el mes escrito completo
    const raw = "2026-septiembre-07"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el nombre del mes no impide el parseo
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("ignora la hora Z de un ISO completo", () => {
    // Dado: un ISO con hora UTC
    const raw = "2026-09-07T00:00:00Z"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se descarta la hora y queda la fecha
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("ignora la hora con offset horario", () => {
    // Dado: un ISO con hora y desplazamiento -06:00
    const raw = "2026-09-07T12:30:00-06:00"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se descarta la hora y el offset
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })
})

describe("parseDate: formatos numéricos día/mes", () => {
  it("parsea 07/09/2026 como día/mes por defecto", () => {
    // Dado: una fecha numérica ambigua
    const raw = "07/09/2026"

    // Cuando: se parsea sin opciones
    const result = parseDate(raw)

    // Entonces: se asume día/mes y confianza media
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })

  it("parsea 7/9/2026 sin ceros a la izquierda", () => {
    // Dado: una fecha numérica de un dígito por parte
    const raw = "7/9/2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se rellena a dos dígitos
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })

  it("acepta guiones como separador", () => {
    // Dado: una fecha DD-MM-YYYY
    const raw = "07-09-2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el resultado es el mismo ISO
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })

  it("acepta puntos como separador", () => {
    // Dado: una fecha DD.MM.YYYY
    const raw = "07.09.2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el resultado es el mismo ISO
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })

  it("expande un año de dos dígitos al siglo XXI", () => {
    // Dado: una fecha con año de dos dígitos
    const raw = "07/09/26"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: 26 se expande a 2026
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })

  it("parsea 07-SEP-26 con mes abreviado y año corto", () => {
    // Dado: una fecha con mes en mayúsculas y año de dos dígitos
    const raw = "07-SEP-26"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se resuelve el mes y se expande el año
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("descarta la hora de 07/09/2026 00:00:00", () => {
    // Dado: una fecha numérica seguida de hora
    const raw = "07/09/2026 00:00:00"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se descarta la hora y se mantiene la ambigüedad día/mes
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "medium" })
  })
})

describe("parseDate: formatos con mes por nombre", () => {
  it("parsea 07 Sep 2026", () => {
    // Dado: una fecha con día, mes abreviado y año
    const raw = "07 Sep 2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se reconoce como 7 de septiembre
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("parsea 07 sep, 2026 con coma", () => {
    // Dado: una fecha con coma antes del año
    const raw = "07 sep, 2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: la coma no interrumpe el parseo
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("parsea Sep 7, 2026 con el mes primero", () => {
    // Dado: una fecha en orden mes/día/año
    const raw = "Sep 7, 2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se reconoce el orden por el nombre del mes
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("parsea September 7 2026 con el mes completo", () => {
    // Dado: una fecha con el mes completo en inglés
    const raw = "September 7 2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se reconoce septiembre
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("parsea 7 de septiembre de 2026", () => {
    // Dado: una fecha escritas en español con conectores
    const raw = "7 de septiembre de 2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se ignora el conector "de"
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })
})

describe("parseDate: formatos compactos, seriales y epoch", () => {
  it("parsea YYYYMMDD como confianza alta", () => {
    // Dado: ocho dígitos que empiezan con un año válido
    const raw = "20260907"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se interpreta año, mes y día
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "high" })
  })

  it("parsea DDMMYYYY como confianza baja", () => {
    // Dado: ocho dígitos que terminan con un año válido
    const raw = "07092026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se interpreta día, mes y año
    expect(result).toMatchObject({ iso: "2026-09-07", confidence: "low" })
  })

  it("convierte el serial de Excel 45930", () => {
    // Dado: un serial de Excel de cinco dígitos
    const raw = "45930"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: corresponde al 30 de septiembre de 2025
    expect(result).toMatchObject({ iso: "2025-09-30", confidence: "low" })
  })

  it("convierte un timestamp epoch en segundos", () => {
    // Dado: 1757203200, que equivale a 2025-09-07T00:00:00Z
    const raw = "1757203200"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se interpreta como segundos y se usa UTC
    expect(result).toMatchObject({ iso: "2025-09-07", confidence: "low" })
  })

  it("convierte un timestamp epoch en milisegundos", () => {
    // Dado: 1757203200000, el mismo instante en milisegundos
    const raw = "1757203200000"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: se interpreta como milisegundos y se usa UTC
    expect(result).toMatchObject({ iso: "2025-09-07", confidence: "low" })
  })
})

describe("parseDate: validación de calendario", () => {
  it("rechaza el 31 de febrero", () => {
    // Dado: una fecha con día inexistente en febrero
    const raw = "31/02/2026"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza el 30 de febrero", () => {
    // Dado: una fecha imposible en un año no bisiesto
    const raw = "30/02/2026"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza un día mayor a 31", () => {
    // Dado: una fecha con día 32
    const raw = "32/01/2026"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza mes 13 en ambos campos", () => {
    // Dado: una fecha con mes inválido en las dos posiciones
    const raw = "13/13/2026"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza un ISO con día inexistente", () => {
    // Dado: una fecha ISO con 30 de febrero
    const raw = "2026-02-30"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza el 31 de abril", () => {
    // Dado: una fecha con día inexistente en abril
    const raw = "2026-04-31"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })

  it("acepta el 29 de febrero de un año bisiesto", () => {
    // Dado: el 29 de febrero de 2024
    const raw = "29/02/2024"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: la fecha existe
    expect(result).toMatchObject({ iso: "2024-02-29", confidence: "high" })
  })

  it("rechaza el 29 de febrero de un año no bisiesto", () => {
    // Dado: el 29 de febrero de 2025
    const raw = "29/02/2025"

    // Cuando: se parsea
    // Entonces: no se acepta
    expect(parseDate(raw)).toBeNull()
  })
})

describe("parseDate: rango de años", () => {
  it("acepta un año dentro del máximo por defecto", () => {
    // Dado: una fecha del año 2099
    const raw = "07/09/2099"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: está dentro del rango 1900..2100
    expect(result).toMatchObject({ iso: "2099-09-07", confidence: "medium" })
  })

  it("rechaza un año mayor al máximo por defecto", () => {
    // Dado: una fecha del año 2101
    const raw = "07/09/2101"

    // Cuando: se parsea
    // Entonces: supera maxYear 2100
    expect(parseDate(raw)).toBeNull()
  })

  it("rechaza un año anterior al mínimo por defecto", () => {
    // Dado: una fecha del año 1800
    const raw = "01/01/1800"

    // Cuando: se parsea
    // Entonces: no llega a minYear 1900
    expect(parseDate(raw)).toBeNull()
  })

  it("respeta un maxYear explícito", () => {
    // Dado: una fecha de 2099 y un máximo de 2050
    const raw = "07/09/2099"

    // Cuando: se parsea con maxYear 2050
    // Entonces: no se acepta
    expect(parseDate(raw, { maxYear: 2050 })).toBeNull()
  })
})

describe("parseDate: ambigüedad día/mes", () => {
  it("interpreta 01/02/2026 como 1 de febrero por defecto", () => {
    // Dado: una fecha donde ambos números son menores a 13
    const raw = "01/02/2026"

    // Cuando: se parsea sin opciones
    const result = parseDate(raw)

    // Entonces: se asume día/mes con confianza media
    expect(result).toMatchObject({ iso: "2026-02-01", confidence: "medium" })
  })

  it("interpreta 01/02/2026 como 2 de enero con dayFirst false", () => {
    // Dado: la misma fecha ambigua
    const raw = "01/02/2026"

    // Cuando: se parsea con dayFirst false
    const result = parseDate(raw, { dayFirst: false })

    // Entonces: se asume mes/día
    expect(result).toMatchObject({ iso: "2026-01-02", confidence: "medium" })
  })

  it("resuelve 13/02/2026 como día/mes sin ambigüedad", () => {
    // Dado: una fecha con primer número mayor a 12
    const raw = "13/02/2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el 13 solo puede ser el día
    expect(result).toMatchObject({ iso: "2026-02-13", confidence: "high" })
  })

  it("resuelve 02/13/2026 como mes/día sin ambigüedad", () => {
    // Dado: una fecha con segundo número mayor a 12
    const raw = "02/13/2026"

    // Cuando: se parsea
    const result = parseDate(raw)

    // Entonces: el 13 solo puede ser el día
    expect(result).toMatchObject({ iso: "2026-02-13", confidence: "high" })
  })
})

describe("resolveDayFirst", () => {
  it("detecta día/mes cuando aparece un día mayor a 12", () => {
    // Dado: una muestra con 13 en la primera posición
    const samples = ["13/01/2026"]

    // Cuando: se resuelve el orden
    // Entonces: el archivo es día/mes
    expect(resolveDayFirst(samples)).toBe(true)
  })

  it("detecta mes/día cuando aparece un mes mayor a 12 en la segunda posición", () => {
    // Dado: una muestra con 13 en la segunda posición
    const samples = ["01/13/2026"]

    // Cuando: se resuelve el orden
    // Entonces: el archivo es mes/día
    expect(resolveDayFirst(samples)).toBe(false)
  })

  it("asume día/mes cuando no hay evidencia", () => {
    // Dado: una fecha ambigua sin valores mayores a 12
    const samples = ["01/02/2026"]

    // Cuando: se resuelve el orden
    // Entonces: se usa el default latinoamericano
    expect(resolveDayFirst(samples)).toBe(true)
  })

  it("asume día/mes para una lista vacía", () => {
    // Dado: ninguna muestra
    const samples: string[] = []

    // Cuando: se resuelve el orden
    // Entonces: se usa el default latinoamericano
    expect(resolveDayFirst(samples)).toBe(true)
  })

  it("asume día/mes ante evidencia contradictoria", () => {
    // Dado: una muestra día/mes y otra mes/día
    const samples = ["13/01/2026", "01/13/2026"]

    // Cuando: se resuelve el orden
    // Entonces: el empate se resuelve con el default
    expect(resolveDayFirst(samples)).toBe(true)
  })

  it("ignora las muestras que no son fechas numéricas", () => {
    // Dado: una muestra inválida junto a una de día/mes
    const samples = ["abc", "13/01/2026"]

    // Cuando: se resuelve el orden
    // Entonces: solo vota la muestra válida
    expect(resolveDayFirst(samples)).toBe(true)
  })
})

describe("isValidIsoDate", () => {
  it("acepta una fecha ISO que existe", () => {
    // Dado: una fecha ISO válida
    // Cuando: se valida
    // Entonces: devuelve true
    expect(isValidIsoDate("2026-09-07")).toBe(true)
  })

  it("acepta el 29 de febrero de 2024", () => {
    // Dado: el 29 de febrero de un año bisiesto
    // Cuando: se valida
    // Entonces: devuelve true
    expect(isValidIsoDate("2024-02-29")).toBe(true)
  })

  it("rechaza una fecha ISO inexistente", () => {
    // Dado: el 30 de febrero de 2026
    // Cuando: se valida
    // Entonces: devuelve false
    expect(isValidIsoDate("2026-02-30")).toBe(false)
  })

  it("rechaza el 29 de febrero de 2025", () => {
    // Dado: el 29 de febrero de un año no bisiesto
    // Cuando: se valida
    // Entonces: devuelve false
    expect(isValidIsoDate("2025-02-29")).toBe(false)
  })

  it("rechaza un formato que no es ISO", () => {
    // Dado: una fecha DD/MM/YYYY
    // Cuando: se valida
    // Entonces: devuelve false
    expect(isValidIsoDate("07/09/2026")).toBe(false)
  })

  it("rechaza la cadena vacía", () => {
    // Dado: un texto vacío
    // Cuando: se valida
    // Entonces: devuelve false
    expect(isValidIsoDate("")).toBe(false)
  })
})

describe("parseDate: entradas inválidas", () => {
  it("rechaza la cadena vacía", () => {
    // Dado: un texto vacío
    // Cuando: se parsea
    // Entonces: no hay fecha
    expect(parseDate("")).toBeNull()
  })

  it("rechaza texto sin dígitos", () => {
    // Dado: una palabra sin números
    // Cuando: se parsea
    // Entonces: no hay fecha
    expect(parseDate("abc")).toBeNull()
  })

  it("rechaza una etiqueta de estado de cuenta", () => {
    // Dado: texto de cabecera de un documento
    // Cuando: se parsea
    // Entonces: no hay fecha
    expect(parseDate("Estado de cuenta")).toBeNull()
  })

  it("rechaza un año suelto", () => {
    // Dado: solo cuatro dígitos que podrían ser un año
    // Cuando: se parsea
    // Entonces: no hay fecha
    expect(parseDate("2026")).toBeNull()
  })

  it("rechaza un número de referencia con guion", () => {
    // Dado: un número de referencia con formato 5-4
    // Cuando: se parsea
    // Entonces: no hay fecha
    expect(parseDate("12345-6789")).toBeNull()
  })

  it("no confunde números de referencia largos con timestamps", () => {
    // Dado: números de referencia con ceros a la izquierda y 8 u 10 dígitos
    const references = ["0000012345", "20260001"]

    // Cuando: se parsea cada uno
    const results = references.map((reference) => parseDate(reference))

    // Entonces: ninguno debe interpretarse como fecha
    expect(results).toEqual([null, null])
  })
})
