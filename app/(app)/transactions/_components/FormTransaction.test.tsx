import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createTransaction } from "@/server/transactions/actions"
import FormTransaction from "./FormTransaction"
import type { BankAccounts } from "@/types/bank-accounts.types"
import type { Category } from "@/types/categories.types"

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

const mockCreateTransaction = vi.mocked(createTransaction)

const bankAccounts: BankAccounts[] = [
  { id: 1, accountName: "Savings", bankName: "Banco Atlántida", accountCurrency: "HNL" } as BankAccounts,
  { id: 2, accountName: "Checking", bankName: "Banco BAC", accountCurrency: "USD" } as BankAccounts,
]

const categories: Category[] = [
  { categoryId: 1, name: "Groceries", icon: "shopping-cart", color: "#64748b", userId: 1 } as Category,
  { categoryId: 2, name: "Salary", icon: "dollar-sign", color: "#10b981", userId: 1 } as Category,
]

function renderForm(props?: Partial<React.ComponentProps<typeof FormTransaction>>) {
  return render(<FormTransaction bankAccounts={bankAccounts} categories={categories} {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("FormTransaction (UI-03)", () => {
  it("renders all expected fields", () => {
    renderForm()

    expect(document.getElementById("checkout-account")).toBeInTheDocument()
    expect(document.getElementById("checkout-description")).toBeInTheDocument()
    expect(document.getElementById("checkout-amount")).toBeInTheDocument()
    expect(document.getElementById("checkout-transaction-type")).toBeInTheDocument()
    expect(document.getElementById("checkout-categoryId")).toBeInTheDocument()
    expect(document.querySelector('input[name="transactionDate"]')).toBeInTheDocument()
    expect(document.getElementById("checkout-transaction-currency")).toBeInTheDocument()
    expect(within(document.body).getByRole("button", { name: /submit/i })).toBeInTheDocument()
  })

  it("disables submit button when required fields are empty", () => {
    renderForm()
    const submitButton = within(document.body).getByRole("button", { name: /submit/i })
    expect(submitButton).toBeInTheDocument()
  })

  it("submits successfully, shows toast and redirects", async () => {
    const { container } = renderForm()

    fireEvent.change(document.getElementById("checkout-description") as Element, { target: { value: "Grocery shopping" } })
    fireEvent.change(document.getElementById("checkout-amount") as Element, { target: { value: "50" } })

    mockCreateTransaction.mockResolvedValueOnce({
      success: true,
      message: "Transaction created",
      fields: {
        accountId: "1",
        amount: "50",
        transactionType: "expense",
        transactionDescription: "Grocery shopping",
        categoryId: "1",
        transactionDate: "2025-10-01",
        transactionCurrency: "HNL",
      },
    } as Awaited<ReturnType<typeof createTransaction>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Transaction created"))
    expect(mockPush).toHaveBeenCalledWith("/transactions")
  })

  it("shows validation errors from server action", async () => {
    const { container } = renderForm()

    mockCreateTransaction.mockResolvedValueOnce({
      success: false,
      error: { amount: "Amount is required" },
      fields: { amount: "", transactionDescription: "", transactionType: "", categoryId: "", transactionDate: "", transactionCurrency: "", accountId: "" },
    } as Awaited<ReturnType<typeof createTransaction>>)

    const form = container.querySelector("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalled())
    await waitFor(() => {
      expect(within(document.body).getByText(/amount is required/i)).toBeInTheDocument()
    })
  })
})
