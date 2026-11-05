import { render, cleanup, screen } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import React from "react"
import { ExpensesByCategoryChart } from "./ExpensesByCategoriesChart"

afterEach(() => {
  cleanup()
})

describe("ExpensesByCategoryChart (UI-08)", () => {
  it("renders the card title and description", () => {
    render(<ExpensesByCategoryChart data={[]} currency="HNL" />)

    expect(screen.getByText("Expenses by category")).toBeInTheDocument()
    expect(
      screen.getByText(`Throughout ${new Date().getFullYear()}`)
    ).toBeInTheDocument()
  })

  it("shows the highest spending category in the footer", () => {
    const data = [
      {
        categoryName: "Groceries",
        categoryColor: "#64748b",
        categoryIcon: "shopping-cart",
        total_amount: 500,
      },
      {
        categoryName: "Rent",
        categoryColor: "#10b981",
        categoryIcon: "home",
        total_amount: 300,
      },
    ]

    const { container } = render(
      <ExpensesByCategoryChart data={data} currency="HNL" />
    )

    const footer = container.querySelector('[data-slot="card-footer"]')
    expect(footer?.textContent).toContain("Groceries")
    expect(footer?.textContent).toContain("L. 500.00")
  })

  it("renders without crashing when data is null", () => {
    render(<ExpensesByCategoryChart data={null} currency="USD" />)

    expect(screen.getByText("Expenses by category")).toBeInTheDocument()
  })
})
