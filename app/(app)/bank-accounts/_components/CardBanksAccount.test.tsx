import { render, cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { deleteBankAccount } from "@/server/bank-accounts/actions"
import type { BankAccounts } from "@/types/bank-accounts.types"
import BankAccountsCard from "./CardBanksAccount"

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

describe("BankAccountsCard (UI-14)", () => {
  it("shows the empty state when there are no accounts", () => {
    render(<BankAccountsCard data={[]} />)

    expect(
      screen.getByText(/there are no bank accounts registered yet/i)
    ).toBeInTheDocument()
  })

  it("renders the account summary", () => {
    render(<BankAccountsCard data={bankAccounts} />)

    expect(screen.getByText("Savings")).toBeInTheDocument()
    expect(screen.getByText("123456789")).toBeInTheDocument()
  })

  it("expands to show the account details", async () => {
    const user = userEvent.setup()
    render(<BankAccountsCard data={bankAccounts} />)

    await user.click(screen.getByRole("button", { name: /savings/i }))

    expect(await screen.findByText("Bank Name:")).toBeInTheDocument()
    expect(screen.getByText("Banco Atlántida")).toBeInTheDocument()
    expect(screen.getByText("L. 1,500.50")).toBeInTheDocument()
    expect(screen.getByText("savings@example.com")).toBeInTheDocument()
  })

  it("navigates to the edit page", async () => {
    const user = userEvent.setup()
    render(<BankAccountsCard data={bankAccounts} />)

    await user.click(screen.getByRole("button", { name: /savings/i }))
    await user.click(await screen.findByRole("button", { name: /edit/i }))

    expect(mockPush).toHaveBeenCalledWith("/bank-accounts/Savings?id=1")
  })

  it("deletes the account", async () => {
    const user = userEvent.setup()
    render(<BankAccountsCard data={bankAccounts} />)

    mockDeleteBankAccount.mockResolvedValueOnce({
      success: true,
      message: "Bank account deleted",
    })

    await user.click(screen.getByRole("button", { name: /savings/i }))
    await user.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => expect(mockDeleteBankAccount).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Bank account deleted")
    )
  })
})
