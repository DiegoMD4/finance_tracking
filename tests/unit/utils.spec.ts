import { describe, expect, it } from "vitest"
import {
  CURRENCY_OPTIONS,
  formatCompactCurrency,
  formatCurrency,
} from "@/lib/utils"

describe("formatCurrency", () => {
  it("L-08: formats a number with HNL symbol", () => {
    expect(formatCurrency(1234.5, "HNL")).toBe("L. 1,234.50")
  })

  it("L-09: formats numeric string with USD symbol", () => {
    expect(formatCurrency("100", "USD")).toBe("$ 100.00")
  })

  it("L-10: returns 0.00 for non-numeric value", () => {
    expect(formatCurrency("abc")).toBe("0.00")
  })

  it("L-08b: formats with EUR symbol", () => {
    expect(formatCurrency(1234.5, "EUR")).toBe("€ 1,234.50")
  })
})

describe("formatCompactCurrency", () => {
  it("L-11: uses compact notation", () => {
    expect(formatCompactCurrency(15000, "HNL")).toBe("L. 15K")
  })
})

describe("CURRENCY_OPTIONS", () => {
  it("L-12: contains HNL, USD and EUR", () => {
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
