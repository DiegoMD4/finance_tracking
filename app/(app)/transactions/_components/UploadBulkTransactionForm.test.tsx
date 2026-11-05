import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createBulkTransactions } from "@/server/transactions/actions"
import { extractTransactions } from "@/lib/parsers/file-extractor"
import { UploadBulkTransactionForm } from "./UploadBulkTransactionForm"
import type { BankAccounts } from "@/types/bank-accounts.types"
import type { ParsedTransaction } from "@/lib/parsers/types"

const { mockPush, mockToastSuccess, mockToastError, mockToastWarning } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, warning: mockToastWarning },
}))

vi.mock("@/lib/parsers/file-extractor", () => ({
  extractTransactions: vi.fn(),
}))

const mockCreateBulkTransactions = vi.mocked(createBulkTransactions)
const mockExtractTransactions = vi.mocked(extractTransactions)

const bankAccounts: BankAccounts[] = [
  { id: 1, bankName: "Banco Atlántida", accountName: "Savings", accountCurrency: "HNL" } as BankAccounts,
]

const categories: Array<import("@/types/categories.types").Category> = []

function renderForm(props?: Partial<React.ComponentProps<typeof UploadBulkTransactionForm>>) {
  return render(<UploadBulkTransactionForm bankAccounts={bankAccounts} categories={categories} defaultCurrency="HNL" {...props} />)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("UploadBulkTransactionForm (UI-05)", () => {
  it("renders upload form with account and currency selects", () => {
    renderForm()

    expect(document.getElementById("bankAccount")).toBeInTheDocument()
    expect(document.getElementById("transactionCurrency")).toBeInTheDocument()
    expect(within(document.body).getByLabelText(/drag your file here/i)).toBeInTheDocument()
  })

  it("extracts transactions from an uploaded file and shows the preview table", async () => {
    const user = userEvent.setup()
    renderForm()

    const accountTrigger = document.getElementById("bankAccount") as HTMLElement
    await user.click(accountTrigger)
    const option = await within(document.body).findByRole("option", { name: /Banco Atlántida - Savings \(HNL\)/i })
    await user.click(option)

    const parsed: ParsedTransaction[] = [
      {
        tempId: "1",
        bankReference: "REF-001",
        transactionDate: "2025-10-01",
        transactionDescription: "Supermarket purchase",
        transactionType: "expense",
        amount: "25.50",
        categoryId: null,
      },
    ]

    mockExtractTransactions.mockResolvedValueOnce({
      transactions: parsed,
      errors: [],
      source: "csv",
      fileName: "test.csv",
    } as Awaited<ReturnType<typeof extractTransactions>>)

    const fileInput = within(document.body).getByLabelText(/drag your file here/i)
    const file = new File(["date,amount\n2025-10-01,25.50"], "test.csv", { type: "text/csv" })
    await user.upload(fileInput, file)

    expect(await within(document.body).findByDisplayValue("Supermarket purchase")).toBeInTheDocument()
  })

  it("shows error toast when file has no transactions", async () => {
    const user = userEvent.setup()
    renderForm()

    const accountTrigger = document.getElementById("bankAccount") as HTMLElement
    await user.click(accountTrigger)
    const option = await within(document.body).findByRole("option", { name: /Banco Atlántida - Savings \(HNL\)/i })
    await user.click(option)

    mockExtractTransactions.mockResolvedValueOnce({
      transactions: [],
      errors: ["No transactions found"],
      source: "csv",
      fileName: "empty.csv",
    } as Awaited<ReturnType<typeof extractTransactions>>)

    const fileInput = within(document.body).getByLabelText(/drag your file here/i)
    const file = new File(["empty"], "empty.csv", { type: "text/csv" })
    await user.upload(fileInput, file)

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
  })

  it("submits bulk transactions, shows toast and redirects", async () => {
    const user = userEvent.setup()
    renderForm()

    const accountTrigger = document.getElementById("bankAccount") as HTMLElement
    await user.click(accountTrigger)
    const option = await within(document.body).findByRole("option", { name: /Banco Atlántida - Savings \(HNL\)/i })
    await user.click(option)

    const parsed: ParsedTransaction[] = [
      {
        tempId: "1",
        bankReference: "REF-001",
        transactionDate: "2025-10-01",
        transactionDescription: "Supermarket purchase",
        transactionType: "expense",
        amount: "25.50",
        categoryId: null,
      },
    ]

    mockExtractTransactions.mockResolvedValueOnce({
      transactions: parsed,
      errors: [],
      source: "csv",
      fileName: "test.csv",
    } as Awaited<ReturnType<typeof extractTransactions>>)

    const fileInput = within(document.body).getByLabelText(/drag your file here/i)
    const file = new File(["date,amount\n2025-10-01,25.50"], "test.csv", { type: "text/csv" })
    await user.upload(fileInput, file)

    await within(document.body).findByDisplayValue("Supermarket purchase")

    mockCreateBulkTransactions.mockResolvedValueOnce({
      success: true,
      message: "Transactions saved",
      saved: 1,
      failed: 0,
      rows: [],
      savedTempIds: ["1"],
    } as Awaited<ReturnType<typeof createBulkTransactions>>)

    const saveButton = within(document.body).getByRole("button", { name: /save transactions/i })
    fireEvent.click(saveButton)

    await waitFor(() => expect(mockCreateBulkTransactions).toHaveBeenCalled())
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Transactions saved"))
    expect(mockPush).toHaveBeenCalledWith("/transactions")
  })

  it("clears the preview table when Clear table is clicked", async () => {
    const user = userEvent.setup()
    renderForm()

    const accountTrigger = document.getElementById("bankAccount") as HTMLElement
    await user.click(accountTrigger)
    const option = await within(document.body).findByRole("option", { name: /Banco Atlántida - Savings \(HNL\)/i })
    await user.click(option)

    const parsed: ParsedTransaction[] = [
      {
        tempId: "1",
        bankReference: "REF-001",
        transactionDate: "2025-10-01",
        transactionDescription: "Supermarket purchase",
        transactionType: "expense",
        amount: "25.50",
        categoryId: null,
      },
    ]

    mockExtractTransactions.mockResolvedValueOnce({
      transactions: parsed,
      errors: [],
      source: "csv",
      fileName: "test.csv",
    } as Awaited<ReturnType<typeof extractTransactions>>)

    const fileInput = within(document.body).getByLabelText(/drag your file here/i)
    const file = new File(["date,amount\n2025-10-01,25.50"], "test.csv", { type: "text/csv" })
    await user.upload(fileInput, file)

    await within(document.body).findByDisplayValue("Supermarket purchase")
    const clearButton = within(document.body).getByRole("button", { name: /clear table/i })
    fireEvent.click(clearButton)

    await waitFor(() => {
      expect(within(document.body).queryByDisplayValue("Supermarket purchase")).not.toBeInTheDocument()
    })
  })

  it("disables dropzone until an account is selected", () => {
    renderForm()
    const dropzone = within(document.body).getByLabelText(/drag your file here/i)
    expect(dropzone).toBeInTheDocument()
  })
})
