import { render, cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { deleteTransaction } from "@/server/transactions/actions"
import type { TransactionListItem } from "@/types/transactions.types"
import { TransactionsTable } from "./TransactionsTable"

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

describe("TransactionsTable (UI-12)", () => {
  it("renders the transaction rows", () => {
    render(<TransactionsTable data={transactions} />)

    expect(screen.getByText("Supermarket purchase")).toBeInTheDocument()
    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.getByText("Savings")).toBeInTheDocument()
    expect(screen.getByText("Banco Atlántida")).toBeInTheDocument()
    expect(screen.getByText("expense")).toBeInTheDocument()
    expect(screen.getByText("L. 25.50")).toBeInTheDocument()
    expect(screen.getByText("2025-10-01")).toBeInTheDocument()
  })

  it("falls back to placeholders when optional values are missing", () => {
    const [transaction] = transactions
    render(
      <TransactionsTable
        data={[
          {
            ...transaction,
            transactionDescription: null,
            categoryName: null,
            accountName: null,
            bankName: null,
          },
        ]}
      />
    )

    expect(screen.getByText("Unnamed account")).toBeInTheDocument()
    expect(screen.getByText("Unknown bank")).toBeInTheDocument()
    expect(screen.getAllByText("-")).toHaveLength(2)
  })

  it("shows the empty state when there are no transactions", () => {
    render(<TransactionsTable data={[]} />)

    expect(
      screen.getByText(/there are no transactions registered for this user/i)
    ).toBeInTheDocument()
  })

  it("navigates to the transaction detail from the actions menu", async () => {
    const user = userEvent.setup()
    render(<TransactionsTable data={transactions} />)

    await user.click(screen.getByRole("button", { name: /open menu/i }))
    await user.click(
      await screen.findByRole("menuitem", { name: /view details/i })
    )

    expect(mockPush).toHaveBeenCalledWith(
      "/transactions/transaction-detail?id=1"
    )
  })

  it("deletes the transaction from the actions menu", async () => {
    const user = userEvent.setup()
    render(<TransactionsTable data={transactions} />)

    mockDeleteTransaction.mockResolvedValueOnce({
      success: true,
      message: "Transaction deleted",
    })

    await user.click(screen.getByRole("button", { name: /open menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }))
    await user.click(await screen.findByRole("button", { name: /delete/i }))

    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Transaction deleted")
    )
  })
})
