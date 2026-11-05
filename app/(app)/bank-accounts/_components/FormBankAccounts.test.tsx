import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createBankAccount } from "@/server/bank-accounts/actions"
import FormBankAccounts from "./FormBankAccounts"

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

const mockCreateBankAccount = vi.mocked(createBankAccount)

function renderForm(props?: React.ComponentProps<typeof FormBankAccounts>) {
  return render(<FormBankAccounts {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("FormBankAccounts (UI-01)", () => {
  it("renders all expected fields", () => {
    renderForm()

    expect(document.getElementById("checkout-bank-name")).toBeInTheDocument()
    expect(document.getElementById("checkout-account-name")).toBeInTheDocument()
    expect(document.getElementById("checkout-currency")).toBeInTheDocument()
    expect(document.getElementById("checkout-balance")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /submit/i })).toBeInTheDocument()
  })

  it("submits successfully, shows toast and redirects", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("checkout-bank-name") as Element, { target: { value: "Banco Atlántida" } })
    fireEvent.change(document.getElementById("checkout-account-name") as Element, { target: { value: "Savings" } })
    fireEvent.change(document.getElementById("checkout-currency") as Element, { target: { value: "HNL" } })
    fireEvent.change(document.getElementById("checkout-balance") as Element, { target: { value: "1000" } })

    mockCreateBankAccount.mockResolvedValueOnce({
      success: true,
      message: "Bank account created",
      fields: {} as Record<string, string>,
    } as Awaited<ReturnType<typeof createBankAccount>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateBankAccount).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Bank account created"))
    expect(mockPush).toHaveBeenCalledWith("/bank-accounts")
  })

  it("shows validation errors from server action", async () => {
    const { container } = renderForm()

    mockCreateBankAccount.mockResolvedValueOnce({
      success: false,
      message: "Account name is required",
      error: { accountName: "Account name is required" },
      fields: { accountName: "", bankName: "", accountNumber: "", accountEmail: "", bankAccountType: "", accountCurrency: "", openingBalance: "" },
    } as Awaited<ReturnType<typeof createBankAccount>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateBankAccount).toHaveBeenCalled())
  })
})
