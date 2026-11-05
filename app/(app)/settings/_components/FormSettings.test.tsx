import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { updateDefaultCurrency } from "@/server/users/actions"
import { FormSettings } from "./FormSettings"

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

const mockUpdateDefaultCurrency = vi.mocked(updateDefaultCurrency)

function renderForm(props: React.ComponentProps<typeof FormSettings> = { currentCurrency: "HNL" }) {
  return render(<FormSettings {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("FormSettings (UI-04)", () => {
  it("renders currency select and save button", () => {
    renderForm({ currentCurrency: "HNL" })

    expect(document.getElementById("settings-currency")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /save/i })).toBeInTheDocument()
  })

  it("submits successfully and shows toast", async () => {
    const { container } = renderForm({ currentCurrency: "HNL" })

    fireEvent.change(document.getElementById("settings-currency") as Element, { target: { value: "USD" } })

    mockUpdateDefaultCurrency.mockResolvedValueOnce({
      success: true,
      message: "Currency updated",
      fields: { currency: "USD" },
    } as Awaited<ReturnType<typeof updateDefaultCurrency>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockUpdateDefaultCurrency).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Currency updated"))
  })

  it("shows validation errors from server action", async () => {
    const { container } = renderForm({ currentCurrency: "HNL" })

    mockUpdateDefaultCurrency.mockResolvedValueOnce({
      success: false,
      message: "Invalid currency",
      error: { currency: "Invalid currency" },
      fields: { currency: "HNL" },
    } as Awaited<ReturnType<typeof updateDefaultCurrency>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockUpdateDefaultCurrency).toHaveBeenCalled())
    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
  })
})
