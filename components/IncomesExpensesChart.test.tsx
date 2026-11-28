import { render, cleanup, screen } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import React from "react"
import { IncomesExpensesChart } from "./IncomesExpensesChart"

afterEach(() => {
  cleanup()
})

const currentYear = new Date().getFullYear()

const data = [
  {
    year: currentYear,
    monthNumber: 1,
    month: "January",
    income: 1000,
    expense: 500,
  },
  {
    year: currentYear,
    monthNumber: 2,
    month: "February",
    income: 800,
    expense: 900,
  },
]

describe("IncomesExpensesChart (UI-09)", () => {
  it("renders the card title and description", () => {
    render(<IncomesExpensesChart data={data} currency="HNL" />)

    expect(screen.getByText("Incomes vs Expenses")).toBeInTheDocument()
    expect(
      screen.getByText(/Comparison between incomes and expenses/i)
    ).toBeInTheDocument()
  })

  it("shows a positive net balance when incomes exceed expenses", () => {
    render(<IncomesExpensesChart data={data} currency="HNL" />)

    expect(
      screen.getByText(/Positive net balance for this period/i)
    ).toBeInTheDocument()
  })

  it("shows a negative message when expenses exceed incomes", () => {
    const negativeData = [
      {
        year: currentYear,
        monthNumber: 1,
        month: "January",
        income: 100,
        expense: 500,
      },
      {
        year: currentYear,
        monthNumber: 2,
        month: "February",
        income: 200,
        expense: 600,
      },
    ]

    render(<IncomesExpensesChart data={negativeData} currency="USD" />)

    expect(screen.getByText(/Expenses exceed revenue/i)).toBeInTheDocument()
  })

  it("shows the covered month range in the footer", () => {
    render(<IncomesExpensesChart data={data} currency="HNL" />)

    expect(
      screen.getByText(`January - February ${currentYear}`)
    ).toBeInTheDocument()
  })

  it("shows both years when the range crosses a year boundary", () => {
    const crossYearData = [
      {
        year: 2025,
        monthNumber: 12,
        month: "December",
        income: 100,
        expense: 50,
      },
      {
        year: 2026,
        monthNumber: 1,
        month: "January",
        income: 200,
        expense: 80,
      },
    ]

    render(<IncomesExpensesChart data={crossYearData} currency="HNL" />)

    expect(screen.getByText("December 2025 - January 2026")).toBeInTheDocument()
  })
})
