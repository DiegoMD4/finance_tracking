import { describe, expect, it } from "vitest"
import {
  computeCashRunway,
  computeMonthlyNet,
  computeProjectedSpend,
  getDaysInMonth,
} from "@/lib/dashboard/metrics"
import type { MonthlyPace } from "@/types/dashboard.types"

function buildPace(overrides: Partial<MonthlyPace> = {}): MonthlyPace {
  return {
    currentDay: 15,
    daysInMonth: 30,
    daysInPreviousMonth: 31,
    current: { income: 1000, expense: 600 },
    previousSamePeriod: { income: 900, expense: 700 },
    previousFull: { income: 1800, expense: 1500 },
    monthTotal: 600,
    dailyAverage: 40,
    ...overrides,
  }
}

describe("getDaysInMonth", () => {
  it("returns 28 for February 2026", () => {
    expect(getDaysInMonth(2026, 1)).toBe(28)
  })

  it("returns 29 for February 2024 (leap year)", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29)
  })

  it("returns 30 for April and 31 for January", () => {
    expect(getDaysInMonth(2026, 3)).toBe(30)
    expect(getDaysInMonth(2026, 0)).toBe(31)
  })
})

describe("computeMonthlyNet", () => {
  it("computes net, savings rate and comparison against the same period", () => {
    const result = computeMonthlyNet(buildPace())

    expect(result).toEqual({
      net: 400,
      savingsRate: 40,
      delta: 200,
      deltaPercent: 100,
    })
  })

  it("returns a null savings rate when there was no income", () => {
    const result = computeMonthlyNet(
      buildPace({ current: { income: 0, expense: 600 } })
    )

    expect(result.net).toBe(-600)
    expect(result.savingsRate).toBeNull()
  })

  it("returns a null percentage when the previous net is zero", () => {
    const result = computeMonthlyNet(
      buildPace({ previousSamePeriod: { income: 700, expense: 700 } })
    )

    expect(result.delta).toBe(400)
    expect(result.deltaPercent).toBeNull()
  })

  it("returns a null percentage when the previous net is negative", () => {
    const result = computeMonthlyNet(
      buildPace({ previousSamePeriod: { income: 300, expense: 900 } })
    )

    expect(result.delta).toBe(1000)
    expect(result.deltaPercent).toBeNull()
  })

  it("keeps negative savings rates", () => {
    const result = computeMonthlyNet(
      buildPace({
        current: { income: 1000, expense: 1200 },
        previousSamePeriod: { income: 1000, expense: 800 },
      })
    )

    expect(result.net).toBe(-200)
    expect(result.savingsRate).toBe(-20)
    expect(result.delta).toBe(-400)
    expect(result.deltaPercent).toBe(-200)
  })
})

describe("computeCashRunway", () => {
  it("divides the balance by the daily average", () => {
    expect(computeCashRunway(10000, 40)).toEqual({
      days: 250,
      capped: false,
    })
  })

  it("caps the result at 365 days", () => {
    expect(computeCashRunway(20000, 40)).toEqual({
      days: 365,
      capped: true,
    })
  })

  it("does not mark exactly 365 days as capped", () => {
    expect(computeCashRunway(14600, 40)).toEqual({
      days: 365,
      capped: false,
    })
  })

  it("returns zero days for a zero or negative balance", () => {
    expect(computeCashRunway(0, 40)).toEqual({ days: 0, capped: false })
    expect(computeCashRunway(-100, 40)).toEqual({ days: 0, capped: false })
  })

  it("returns null when there is no daily spending", () => {
    expect(computeCashRunway(1000, 0)).toEqual({ days: null, capped: false })
    expect(computeCashRunway(1000, -5)).toEqual({ days: null, capped: false })
  })
})

describe("computeProjectedSpend", () => {
  it("projects the month and compares against the previous full month", () => {
    expect(computeProjectedSpend(buildPace())).toEqual({
      projected: 1200,
      delta: -300,
      deltaPercent: -20,
    })
  })

  it("returns a null percentage when the previous month had no expenses", () => {
    const result = computeProjectedSpend(
      buildPace({ previousFull: { income: 0, expense: 0 } })
    )

    expect(result.projected).toBe(1200)
    expect(result.delta).toBe(1200)
    expect(result.deltaPercent).toBeNull()
  })

  it("projects zero when there is no spending yet", () => {
    const result = computeProjectedSpend(
      buildPace({ dailyAverage: 0, previousFull: { income: 0, expense: 1500 } })
    )

    expect(result.projected).toBe(0)
    expect(result.delta).toBe(-1500)
    expect(result.deltaPercent).toBe(-100)
  })

  it("rounds the projection to two decimals", () => {
    const result = computeProjectedSpend(
      buildPace({ dailyAverage: 33.333, daysInMonth: 30 })
    )

    expect(result.projected).toBe(999.99)
  })
})
