import { render, cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import type { Category } from "@/types/categories.types"
import CardCategories from "./CardCategories"

const { mockPush, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

const categories: Category[] = [
  {
    categoryId: 1,
    userId: 1,
    name: "Groceries",
    icon: "shopping-cart",
    color: "#64748b",
  },
  {
    categoryId: 2,
    userId: 1,
    name: DEFAULT_CATEGORY_NAME,
    icon: "circle",
    color: "#94a3b8",
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("CardCategories (UI-14)", () => {
  it("shows the empty state when there are no categories", () => {
    render(<CardCategories data={[]} />)

    expect(
      screen.getByText(/there is no categories created for this user/i)
    ).toBeInTheDocument()
  })

  it("renders the category names", () => {
    render(<CardCategories data={categories} />)

    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_CATEGORY_NAME)).toBeInTheDocument()
  })

  it("expands to show the category color and actions", async () => {
    const user = userEvent.setup()
    render(<CardCategories data={categories} />)

    await user.click(screen.getByRole("button", { name: /groceries/i }))

    expect(await screen.findByText("Color:")).toBeInTheDocument()
    expect(screen.getByText("#64748b")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  it("navigates to the category detail", async () => {
    const user = userEvent.setup()
    render(<CardCategories data={categories} />)

    await user.click(screen.getByRole("button", { name: /groceries/i }))
    await user.click(await screen.findByRole("button", { name: /edit/i }))

    expect(mockPush).toHaveBeenCalledWith("/categories/category-detail?id=1")
  })

  it("disables delete for the default category", async () => {
    const user = userEvent.setup()
    render(<CardCategories data={categories} />)

    await user.click(
      screen.getByRole("button", { name: new RegExp(DEFAULT_CATEGORY_NAME) })
    )

    const defaultButton = await screen.findByRole("button", {
      name: /default category/i,
    })
    expect(defaultButton).toBeDisabled()
  })
})
