import { render, cleanup, screen } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import React from "react"
import { IncomesExpensesChart } from "./IncomesExpensesChart"

afterEach(() => {
  cleanup()
})

const data = [
  { monthNumber: 1, month: "January", income: 1000, expense: 500 },
  { monthNumber: 2, month: "February", income: 800, expense: 900 },
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
      { monthNumber: 1, month: "January", income: 100, expense: 500 },
      { monthNumber: 2, month: "February", income: 200, expense: 600 },
    ]

    render(<IncomesExpensesChart data={negativeData} currency="USD" />)

    expect(screen.getByText(/Expenses exceed revenue/i)).toBeInTheDocument()
  })

  it("shows the covered month range in the footer", () => {
    render(<IncomesExpensesChart data={data} currency="HNL" />)

    expect(
      screen.getByText(
        `January - February ${new Date().getFullYear()}`
      )
    ).toBeInTheDocument()
  })
})
