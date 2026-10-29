import { describe, expect, it } from "vitest"
import {
  CURRENCY_OPTIONS,
  formatCompactCurrency,
  formatCurrency,
} from "@/lib/utils"

describe("formatCurrency", () => {
  it("L-08: formatea un número con el símbolo de HNL", () => {
    expect(formatCurrency(1234.5, "HNL")).toBe("L. 1,234.50")
  })

  it("L-09: formatea un string numérico con el símbolo de USD", () => {
    expect(formatCurrency("100", "USD")).toBe("$ 100.00")
  })

  it("L-10: retorna 0.00 para un valor no numérico", () => {
    expect(formatCurrency("abc")).toBe("0.00")
  })

  it("L-08b: formatea con el símbolo de EUR", () => {
    expect(formatCurrency(1234.5, "EUR")).toBe("€ 1,234.50")
  })
})

describe("formatCompactCurrency", () => {
  it("L-11: usa notación compacta", () => {
    expect(formatCompactCurrency(15000, "HNL")).toBe("L. 15K")
  })
})

describe("CURRENCY_OPTIONS", () => {
  it("L-12: contiene HNL, USD y EUR", () => {
    expect(CURRENCY_OPTIONS.map((option) => option.value)).toEqual([
      "HNL",
      "USD",
      "EUR",
    ])
    expect(
      CURRENCY_OPTIONS.every((option) => option.label.includes(option.value))
    ).toBe(true)
  })
})
