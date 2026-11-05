import { render, cleanup, screen } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import React from "react"
import { ChartPieSimple } from "./pie-chart"

afterEach(() => {
  cleanup()
})

describe("ChartPieSimple (UI-10)", () => {
  it("renders the card title", () => {
    render(<ChartPieSimple data={[]} currency="HNL" />)

    expect(screen.getByText("Funds distribution by account")).toBeInTheDocument()
  })

  it("maps account names into chart color variables", () => {
    const data = [
      { name: "Savings Account", type: "savings", value: 1000 },
      { name: "Checking", type: "checking", value: 500 },
    ]

    const { container } = render(<ChartPieSimple data={data} currency="HNL" />)

    const style = container.querySelector("style")
    expect(style?.textContent).toContain("--color-savings-account")
    expect(style?.textContent).toContain("--color-checking")
  })
})
