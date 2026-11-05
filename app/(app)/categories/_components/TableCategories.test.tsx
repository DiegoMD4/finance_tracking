import { render, cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { deleteCategory } from "@/server/categories/actions"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import type { Category } from "@/types/categories.types"
import { TableCategories } from "./TableCategories"

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

const mockDeleteCategory = vi.mocked(deleteCategory)

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

describe("TableCategories (UI-13)", () => {
  it("renders the category rows", () => {
    render(<TableCategories data={categories} />)

    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.getByText("#64748b")).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_CATEGORY_NAME)).toBeInTheDocument()
    expect(screen.getByText("#94a3b8")).toBeInTheDocument()
  })

  it("shows the empty state when there are no categories", () => {
    render(<TableCategories data={[]} />)

    expect(
      screen.getByText(/there is no categories created for this user/i)
    ).toBeInTheDocument()
  })

  it("navigates to the category detail from the actions menu", async () => {
    const user = userEvent.setup()
    render(<TableCategories data={categories} />)

    await user.click(screen.getAllByRole("button", { name: /open menu/i })[0])
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }))

    expect(mockPush).toHaveBeenCalledWith("/categories/category-detail?id=1")
  })

  it("disables delete for the default category", async () => {
    const user = userEvent.setup()
    render(<TableCategories data={categories} />)

    await user.click(screen.getAllByRole("button", { name: /open menu/i })[1])
    const deleteItem = await screen.findByRole("menuitem", {
      name: /default category/i,
    })

    expect(deleteItem).toHaveAttribute("aria-disabled", "true")
  })

  it("deletes a non-default category", async () => {
    const user = userEvent.setup()
    render(<TableCategories data={categories} />)

    mockDeleteCategory.mockResolvedValueOnce({
      success: true,
      message: "Category deleted",
    })

    await user.click(screen.getAllByRole("button", { name: /open menu/i })[0])
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))

    await waitFor(() => expect(mockDeleteCategory).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Category deleted")
    )
  })
})
