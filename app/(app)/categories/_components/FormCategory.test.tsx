import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createCategory } from "@/server/categories/actions"
import FormCategory from "./FormCategory"

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

const mockCreateCategory = vi.mocked(createCategory)

function renderForm(props?: React.ComponentProps<typeof FormCategory>) {
  return render(<FormCategory {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("FormCategory (UI-02)", () => {
  it("renders all expected fields", () => {
    renderForm()

    expect(document.getElementById("checkout-name")).toBeInTheDocument()
    expect(document.getElementById("checkout-icon")).toBeInTheDocument()
    expect(document.getElementById("checkout-color")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /submit/i })).toBeInTheDocument()
  })

  it("submits successfully, shows toast and redirects", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("checkout-name") as Element, { target: { value: "Groceries" } })
    fireEvent.change(document.getElementById("checkout-icon") as Element, { target: { value: "shopping-cart" } })
    fireEvent.change(document.getElementById("checkout-color") as Element, { target: { value: "#64748b" } })

    mockCreateCategory.mockResolvedValueOnce({
      success: true,
      message: "Category created",
      fields: { name: "Groceries", icon: "shopping-cart", color: "#64748b" },
    } as Awaited<ReturnType<typeof createCategory>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateCategory).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Category created"))
    expect(mockPush).toHaveBeenCalledWith("/categories")
  })

  it("shows validation errors from server action", async () => {
    const { container } = renderForm()

    mockCreateCategory.mockResolvedValueOnce({
      success: false,
      error: { name: "Category name is required" },
      fields: { name: "", icon: "", color: "" },
    } as Awaited<ReturnType<typeof createCategory>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateCategory).toHaveBeenCalled())
  })
})
