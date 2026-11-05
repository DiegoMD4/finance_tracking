import { render, cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { deleteBankAccount } from "@/server/bank-accounts/actions"
import type { BankAccounts } from "@/types/bank-accounts.types"
import { BankAccountsTable } from "./TableBankAccounts"

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

const mockDeleteBankAccount = vi.mocked(deleteBankAccount)

const bankAccounts: BankAccounts[] = [
  {
    id: 1,
    accountName: "Savings",
    bankName: "Banco Atlántida",
    accountNumber: "123456789",
    accountEmail: "savings@example.com",
    bankAccountType: "savings",
    accountCurrency: "HNL",
    openingBalance: "1500.50",
    userId: 1,
    createdAt: new Date("2025-01-15T12:00:00Z"),
    updatedAt: null,
    deletedAt: null,
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("BankAccountsTable (UI-11)", () => {
  it("renders the account rows with formatted values", () => {
    render(<BankAccountsTable data={bankAccounts} />)

    expect(screen.getByText("Savings")).toBeInTheDocument()
    expect(screen.getByText("Banco Atlántida")).toBeInTheDocument()
    expect(screen.getByText("123456789")).toBeInTheDocument()
    expect(screen.getByText("savings@example.com")).toBeInTheDocument()
    expect(screen.getByText("HNL")).toBeInTheDocument()
    expect(screen.getByText("L. 1,500.50")).toBeInTheDocument()
    expect(
      screen.getByText(bankAccounts[0].createdAt.toLocaleDateString())
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no accounts", () => {
    render(<BankAccountsTable data={[]} />)

    expect(
      screen.getByText(/there is not accounts created for this user/i)
    ).toBeInTheDocument()
  })

  it("navigates to the edit page from the actions menu", async () => {
    const user = userEvent.setup()
    render(<BankAccountsTable data={bankAccounts} />)

    await user.click(screen.getByRole("button", { name: /open menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }))

    expect(mockPush).toHaveBeenCalledWith("/bank-accounts/Savings?id=1")
  })

  it("deletes the account from the actions menu", async () => {
    const user = userEvent.setup()
    render(<BankAccountsTable data={bankAccounts} />)

    mockDeleteBankAccount.mockResolvedValueOnce({
      success: true,
      message: "Bank account deleted",
    })

    await user.click(screen.getByRole("button", { name: /open menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))

    await waitFor(() => expect(mockDeleteBankAccount).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Bank account deleted")
    )
  })
})
