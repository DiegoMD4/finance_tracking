import { render, cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { deleteTransaction } from "@/server/transactions/actions"
import type { TransactionListItem } from "@/types/transactions.types"
import TransactionsCard from "./TransactionsCard"

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

const mockDeleteTransaction = vi.mocked(deleteTransaction)

const transactions: TransactionListItem[] = [
  {
    id: 1,
    userId: 1,
    accountId: 1,
    amount: "25.50",
    transactionType: "expense",
    transactionDescription: "Supermarket purchase",
    categoryId: 1,
    createdAt: new Date("2025-10-01T12:00:00Z"),
    categoryName: "Groceries",
    categoryIcon: "shopping-cart",
    categoryColor: "#64748b",
    transactionDate: "2025-10-01",
    transactionCurrency: "HNL",
    exchangeRate: "1",
    amountInDefaultCurrency: "25.50",
    defaultCurrencyAtTransaction: "HNL",
    bankReference: null,
    accountName: "Savings",
    bankName: "Banco Atlántida",
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("TransactionsCard (UI-14)", () => {
  it("shows the empty state when there are no transactions", () => {
    render(<TransactionsCard data={[]} />)

    expect(
      screen.getByText(/there are no transactions registered yet/i)
    ).toBeInTheDocument()
  })

  it("renders the transaction summary", () => {
    render(<TransactionsCard data={transactions} />)

    expect(screen.getByText("expense")).toBeInTheDocument()
    expect(screen.getByText("L. 25.50")).toBeInTheDocument()
  })

  it("expands to show the transaction details", async () => {
    const user = userEvent.setup()
    render(<TransactionsCard data={transactions} />)

    await user.click(screen.getByRole("button", { name: /expense/i }))

    expect(await screen.findByText("Account:")).toBeInTheDocument()
    expect(screen.getByText("Savings")).toBeInTheDocument()
    expect(screen.getByText("Banco Atlántida")).toBeInTheDocument()
    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.getByText("Supermarket purchase")).toBeInTheDocument()
  })

  it("navigates to the transaction detail", async () => {
    const user = userEvent.setup()
    render(<TransactionsCard data={transactions} />)

    await user.click(screen.getByRole("button", { name: /expense/i }))
    await user.click(
      await screen.findByRole("button", { name: /view details/i })
    )

    expect(mockPush).toHaveBeenCalledWith(
      "/transactions/transaction-detail?id=1"
    )
  })

  it("deletes the transaction", async () => {
    const user = userEvent.setup()
    render(<TransactionsCard data={transactions} />)

    mockDeleteTransaction.mockResolvedValueOnce({
      success: true,
      message: "Transaction deleted",
    })

    await user.click(screen.getByRole("button", { name: /expense/i }))
    await user.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Transaction deleted")
    )
  })
})
