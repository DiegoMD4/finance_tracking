import { render, cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import PaginationTable from "./pagination"

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("PaginationTable (UI-15)", () => {
  it("renders the rows-per-page selector with the current page size", () => {
    render(
      <PaginationTable page={1} pageSize={5} hasMore route="/transactions" />
    )

    expect(screen.getByText("Rows per page")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveTextContent("5")
  })

  it("disables the previous link on the first page", () => {
    render(
      <PaginationTable page={1} pageSize={5} hasMore route="/transactions" />
    )

    const previous = screen.getByRole("link", {
      name: /go to previous page/i,
    })

    expect(previous).toHaveAttribute("aria-disabled", "true")
    expect(previous).toHaveAttribute(
      "href",
      "/transactions?page=1&pageSize=5"
    )
  })

  it("links to the previous page when not on the first page", () => {
    render(
      <PaginationTable page={3} pageSize={5} hasMore route="/transactions" />
    )

    const previous = screen.getByRole("link", {
      name: /go to previous page/i,
    })

    expect(previous).toHaveAttribute("aria-disabled", "false")
    expect(previous).toHaveAttribute(
      "href",
      "/transactions?page=2&pageSize=5"
    )
  })

  it("links to the next page while there are more results", () => {
    render(
      <PaginationTable page={1} pageSize={10} hasMore route="/transactions" />
    )

    const next = screen.getByRole("link", { name: /go to next page/i })

    expect(next).toHaveAttribute("aria-disabled", "false")
    expect(next).toHaveAttribute(
      "href",
      "/transactions?page=2&pageSize=10"
    )
  })

  it("disables the next link on the last page", () => {
    render(
      <PaginationTable
        page={2}
        pageSize={10}
        hasMore={false}
        route="/transactions"
      />
    )

    const next = screen.getByRole("link", { name: /go to next page/i })

    expect(next).toHaveAttribute("aria-disabled", "true")
  })

  it("normalizes an invalid page to the first page", () => {
    render(
      <PaginationTable page={0} pageSize={5} hasMore route="/transactions" />
    )

    const previous = screen.getByRole("link", {
      name: /go to previous page/i,
    })

    expect(previous).toHaveAttribute("aria-disabled", "true")
    expect(previous).toHaveAttribute(
      "href",
      "/transactions?page=1&pageSize=5"
    )
  })

  it("navigates to the first page when the page size changes", async () => {
    const user = userEvent.setup()
    render(
      <PaginationTable page={3} pageSize={5} hasMore route="/transactions" />
    )

    await user.click(screen.getByRole("combobox"))
    await user.click(await screen.findByRole("option", { name: "10" }))

    expect(mockPush).toHaveBeenCalledWith(
      "/transactions?page=1&pageSize=10"
    )
  })
})
