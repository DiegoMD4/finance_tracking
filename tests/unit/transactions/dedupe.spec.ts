import { describe, expect, it } from "vitest"

import {
  assignOccurrences,
  buildDedupePreimage,
  canonicalAmount,
  DEDUPE_MAX_OCCURRENCE,
  isValidOccurrence,
  normalizeForHash,
} from "@/lib/transactions/dedupe"
import { buildDedupeHash } from "@/lib/transactions/dedupe-hash"
import type { DedupeOriginal } from "@/lib/parsers/types"

const buildOriginal = (
  overrides: Partial<DedupeOriginal> = {}
): DedupeOriginal => ({
  date: "2026-01-10",
  amount: "45.00",
  type: "expense",
  reference: "ABC-123",
  description: "Compra POS",
  currency: "HNL",
  ...overrides,
})

const hashOf = (original: Partial<DedupeOriginal> = {}) =>
  buildDedupeHash({
    accountId: 7,
    currency: "HNL",
    original: buildOriginal(original),
  })

describe("normalizeForHash", () => {
  it("quita acentos, pasa a mayúsculas y colapsa espacios", () => {
    expect(normalizeForHash("  Compra   en  Café  ")).toBe("COMPRA EN CAFE")
    expect(normalizeForHash("PAGO TARJETA")).toBe("PAGO TARJETA")
  })

  it("quita caracteres de ancho cero", () => {
    expect(normalizeForHash("COMP\u200BRA")).toBe("COMPRA")
  })

  it("trata null y undefined como texto vacío", () => {
    expect(normalizeForHash(null)).toBe("")
    expect(normalizeForHash(undefined)).toBe("")
    expect(normalizeForHash("")).toBe("")
  })
})

describe("canonicalAmount", () => {
  it("normaliza a dos decimales sin separador de miles", () => {
    expect(canonicalAmount("45.5")).toBe("45.50")
    expect(canonicalAmount("045,50")).toBe("45.50")
    expect(canonicalAmount("1,234.56")).toBe("1234.56")
    expect(canonicalAmount("1234,56")).toBe("1234.56")
    expect(canonicalAmount("L. 500")).toBe("500.00")
  })

  it("mantiene las decisiones del parser sobre separadores", () => {
    // `1.234` son miles; `0.500` es decimal (mismo criterio que money.ts).
    expect(canonicalAmount("1.234")).toBe("1234.00")
    expect(canonicalAmount("0.500")).toBe("0.50")
  })

  it("descarta montos inválidos o fuera de decimal(12,2)", () => {
    expect(canonicalAmount("")).toBeNull()
    expect(canonicalAmount("   ")).toBeNull()
    expect(canonicalAmount("abc")).toBeNull()
    expect(canonicalAmount("10000000000")).toBeNull()
    expect(canonicalAmount("9999999999.99")).toBe("9999999999.99")
  })
})

describe("isValidOccurrence", () => {
  it("acepta enteros entre 1 y el máximo de smallint", () => {
    expect(isValidOccurrence(1)).toBe(true)
    expect(isValidOccurrence(DEDUPE_MAX_OCCURRENCE)).toBe(true)
  })

  it("rechaza cero, negativos, decimales y desbordes", () => {
    expect(isValidOccurrence(0)).toBe(false)
    expect(isValidOccurrence(-1)).toBe(false)
    expect(isValidOccurrence(1.5)).toBe(false)
    expect(isValidOccurrence(DEDUPE_MAX_OCCURRENCE + 1)).toBe(false)
    expect(isValidOccurrence("1")).toBe(false)
    expect(isValidOccurrence(Number.NaN)).toBe(false)
  })
})

describe("buildDedupePreimage", () => {
  it("incluye cuenta, fecha, monto, tipo, moneda y referencia", () => {
    const preimage = buildDedupePreimage({
      accountId: 3,
      currency: "HNL",
      original: buildOriginal(),
    })

    expect(preimage.split("\u001F")).toEqual([
      "3",
      "2026-01-10",
      "45.00",
      "expense",
      "HNL",
      "ABC-123",
    ])
  })

  it("usa la descripción solo cuando no hay referencia", () => {
    const withReference = buildDedupePreimage({
      accountId: 3,
      currency: "HNL",
      original: buildOriginal({ description: "Compra POS" }),
    })
    const withoutReference = buildDedupePreimage({
      accountId: 3,
      currency: "HNL",
      original: buildOriginal({ reference: null }),
    })

    expect(withReference.endsWith("ABC-123")).toBe(true)
    expect(withoutReference.endsWith("COMPRA POS")).toBe(true)
  })
})

describe("buildDedupeHash", () => {
  it("es determinista y devuelve 64 caracteres hex", () => {
    const first = hashOf()
    const second = hashOf()

    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })

  it("no cambia por acentos, mayúsculas ni espacios en la referencia", () => {
    const base = hashOf({ reference: "ABC-123", description: "Compra POS" })
    const noisy = hashOf({
      reference: "  abc-123 ",
      description: "COMPRA   POS",
    })

    expect(noisy).toBe(base)
  })

  it("cambia cuando cambia la moneda, el tipo, la fecha o el monto", () => {
    const base = hashOf()

    expect(
      buildDedupeHash({
        accountId: 7,
        currency: "USD",
        original: buildOriginal(),
      })
    ).not.toBe(base)
    expect(hashOf({ type: "income" })).not.toBe(base)
    expect(hashOf({ date: "2026-01-11" })).not.toBe(base)
    expect(hashOf({ amount: "45.01" })).not.toBe(base)
    expect(hashOf({ reference: "ABC-124" })).not.toBe(base)
  })

  it("cambia cuando cambia la cuenta", () => {
    const base = buildDedupeHash({
      accountId: 7,
      currency: "HNL",
      original: buildOriginal(),
    })
    const other = buildDedupeHash({
      accountId: 8,
      currency: "HNL",
      original: buildOriginal(),
    })

    expect(other).not.toBe(base)
  })

  it("empareja el mismo monto escrito distinto", () => {
    expect(hashOf({ amount: "1234.56" })).toBe(hashOf({ amount: "1,234.56" }))
  })
})

describe("assignOccurrences", () => {
  it("numera 1..n las copias de una misma identidad", () => {
    const items = [
      { currency: "HNL", original: buildOriginal({ reference: null }) },
      { currency: "HNL", original: buildOriginal({ reference: null }) },
      { currency: "HNL", original: buildOriginal({ reference: null }) },
    ]

    expect(assignOccurrences(items)).toEqual([1, 2, 3])
  })

  it("no numera las identidades distintas entre sí", () => {
    const items = [
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
      { currency: "HNL", original: buildOriginal({ reference: "B" }) },
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
    ]

    expect(assignOccurrences(items)).toEqual([1, 1, 2])
  })

  it("es estable ante el orden de otras identidades", () => {
    const first = assignOccurrences([
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
      { currency: "HNL", original: buildOriginal({ reference: "B" }) },
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
      { currency: "HNL", original: buildOriginal({ reference: "B" }) },
    ])
    const second = assignOccurrences([
      { currency: "HNL", original: buildOriginal({ reference: "B" }) },
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
      { currency: "HNL", original: buildOriginal({ reference: "A" }) },
      { currency: "HNL", original: buildOriginal({ reference: "B" }) },
    ])

    expect(first).toEqual([1, 1, 2, 2])
    expect(second).toEqual([1, 1, 2, 2])
  })

  it("devuelve una lista vacía sin filas", () => {
    expect(assignOccurrences([])).toEqual([])
  })
})
