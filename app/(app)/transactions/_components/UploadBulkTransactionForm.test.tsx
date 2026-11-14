import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createBulkTransactions } from "@/server/transactions/actions"
import { suggestTransactionCategories } from "@/server/transactions/ai-actions"
import { extractTransactions } from "@/lib/parsers/file-extractor"
import { UploadBulkTransactionForm } from "./UploadBulkTransactionForm"
import type { BankAccounts } from "@/types/bank-accounts.types"
import type { Category } from "@/types/categories.types"
import type { ParsedTransaction } from "@/lib/parsers/types"

const { mockPush, mockToastSuccess, mockToastError, mockToastWarning, mockToastInfo } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockToastInfo: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, warning: mockToastWarning, info: mockToastInfo },
}))

vi.mock("@/lib/parsers/file-extractor", () => ({
  extractTransactions: vi.fn(),
}))

vi.mock("@/server/transactions/ai-actions", () => ({
  suggestTransactionCategories: vi.fn(),
}))

const mockCreateBulkTransactions = vi.mocked(createBulkTransactions)
const mockExtractTransactions = vi.mocked(extractTransactions)
const mockSuggestTransactionCategories = vi.mocked(suggestTransactionCategories)

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

const foodCategory: Category = {
  categoryId: 5,
  userId: null,
  name: "Food & Dining",
  icon: null,
  color: null,
}

const transportCategory: Category = {
  categoryId: 3,
  userId: null,
  name: "Transportation",
  icon: null,
  color: null,
}

const parsedRow = (overrides?: Partial<ParsedTransaction>): ParsedTransaction => ({
  tempId: "1",
  bankReference: "REF-001",
  transactionDate: "2025-10-01",
  transactionDescription: "Supermarket purchase",
  transactionType: "expense",
  amount: "25.50",
  categoryId: null,
  ...overrides,
})

// Selecciona la cuenta y sube un archivo que devuelve las filas indicadas.
async function uploadParsed(
  user: ReturnType<typeof userEvent.setup>,
  parsed: ParsedTransaction[]
) {
  const accountTrigger = document.getElementById("bankAccount") as HTMLElement
  await user.click(accountTrigger)
  const option = await within(document.body).findByRole("option", {
    name: /Banco Atlántida - Savings \(HNL\)/i,
  })
  await user.click(option)

  mockExtractTransactions.mockResolvedValueOnce({
    transactions: parsed,
    errors: [],
    source: "csv",
    fileName: "test.csv",
  } as Awaited<ReturnType<typeof extractTransactions>>)

  const fileInput = within(document.body).getByLabelText(/drag your file here/i)
  const file = new File(["date,amount"], "test.csv", { type: "text/csv" })
  await user.upload(fileInput, file)

  await within(document.body).findByRole("button", {
    name: /suggest categories with ai/i,
  })
}

// Texto visible del select de categoría de una fila (el trigger muestra la elegida).
function rowCategoryTrigger(description: string): HTMLElement {
  const row = within(document.body).getByDisplayValue(description).closest("tr")
  if (!row) throw new Error(`Row not found for "${description}"`)
  // [0] = Type, [1] = Category
  return within(row as HTMLElement).getAllByRole("combobox")[1]
}

describe("UploadBulkTransactionForm - sugerencias de categorías con IA", () => {
  it("sugiere y aplica la categoría devuelta por la IA", async () => {
    const user = userEvent.setup()
    renderForm({ categories: [foodCategory, transportCategory] })
    await uploadParsed(user, [parsedRow()])

    mockSuggestTransactionCategories.mockResolvedValueOnce({
      success: true,
      message: "1 of 1 transactions have a suggested category",
      suggestions: [
        { tempId: "1", categoryId: "5", confidence: "high", reason: "Supermercado" },
      ],
    })

    const suggestButton = within(document.body).getByRole("button", {
      name: /suggest categories with ai/i,
    })
    await user.click(suggestButton)

    await waitFor(() =>
      expect(mockSuggestTransactionCategories).toHaveBeenCalledTimes(1)
    )
    expect(mockSuggestTransactionCategories).toHaveBeenCalledWith([
      {
        tempId: "1",
        transactionDescription: "Supermarket purchase",
        transactionType: "expense",
        amount: "25.50",
      },
    ])
    await waitFor(() =>
      expect(rowCategoryTrigger("Supermarket purchase")).toHaveTextContent(
        "Food & Dining"
      )
    )
    expect(within(document.body).getByText("IA")).toBeInTheDocument()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("no sobrescribe la categoría que el usuario ya eligió", async () => {
    const user = userEvent.setup()
    renderForm({ categories: [foodCategory, transportCategory] })
    await uploadParsed(user, [
      parsedRow({ tempId: "1", transactionDescription: "Bus ticket", categoryId: "3" }),
      parsedRow({ tempId: "2" }),
    ])

    mockSuggestTransactionCategories.mockResolvedValueOnce({
      success: true,
      message: "1 of 1 transactions have a suggested category",
      suggestions: [
        { tempId: "1", categoryId: "5", confidence: "high", reason: null },
        { tempId: "2", categoryId: "5", confidence: "high", reason: null },
      ],
    })

    await user.click(
      within(document.body).getByRole("button", {
        name: /suggest categories with ai/i,
      })
    )

    await waitFor(() =>
      expect(mockSuggestTransactionCategories).toHaveBeenCalledTimes(1)
    )
    // Solo se envía la fila sin categoría
    expect(mockSuggestTransactionCategories).toHaveBeenCalledWith([
      {
        tempId: "2",
        transactionDescription: "Supermarket purchase",
        transactionType: "expense",
        amount: "25.50",
      },
    ])
    await waitFor(() =>
      expect(rowCategoryTrigger("Supermarket purchase")).toHaveTextContent(
        "Food & Dining"
      )
    )
    // La fila manual conserva su categoría
    expect(rowCategoryTrigger("Bus ticket")).toHaveTextContent("Transportation")
  })

  it("sobrescribe la categoría existente cuando el switch está activo", async () => {
    const user = userEvent.setup()
    renderForm({ categories: [foodCategory, transportCategory] })
    await uploadParsed(user, [
      parsedRow({ tempId: "1", transactionDescription: "Bus ticket", categoryId: "3" }),
      parsedRow({ tempId: "2" }),
    ])

    mockSuggestTransactionCategories.mockResolvedValueOnce({
      success: true,
      message: "2 of 2 transactions have a suggested category",
      suggestions: [
        { tempId: "1", categoryId: "5", confidence: "high", reason: null },
        { tempId: "2", categoryId: "5", confidence: "high", reason: null },
      ],
    })

    await user.click(within(document.body).getByRole("switch"))
    await user.click(
      within(document.body).getByRole("button", {
        name: /suggest categories with ai/i,
      })
    )

    await waitFor(() =>
      expect(mockSuggestTransactionCategories).toHaveBeenCalledTimes(1)
    )
    expect(mockSuggestTransactionCategories).toHaveBeenCalledWith([
      expect.objectContaining({ tempId: "1" }),
      expect.objectContaining({ tempId: "2" }),
    ])
    await waitFor(() => {
      expect(rowCategoryTrigger("Bus ticket")).toHaveTextContent("Food & Dining")
      expect(rowCategoryTrigger("Supermarket purchase")).toHaveTextContent(
        "Food & Dining"
      )
    })
  })

  it("muestra un toast de error y no toca las filas cuando la IA falla", async () => {
    const user = userEvent.setup()
    renderForm({ categories: [foodCategory, transportCategory] })
    await uploadParsed(user, [parsedRow()])

    mockSuggestTransactionCategories.mockResolvedValueOnce({
      success: false,
      message: "Gemini could not suggest categories. Please try again.",
      suggestions: [],
    })

    await user.click(
      within(document.body).getByRole("button", {
        name: /suggest categories with ai/i,
      })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Gemini could not suggest categories. Please try again."
      )
    )
    expect(rowCategoryTrigger("Supermarket purchase")).toHaveTextContent(
      "No category"
    )
    expect(within(document.body).queryByText("IA")).not.toBeInTheDocument()
  })

  it("no llama a la IA cuando las filas no tienen descripción", async () => {
    const user = userEvent.setup()
    renderForm({ categories: [foodCategory, transportCategory] })
    await uploadParsed(user, [parsedRow({ transactionDescription: "" })])

    await user.click(
      within(document.body).getByRole("button", {
        name: /suggest categories with ai/i,
      })
    )

    await waitFor(() =>
      expect(mockToastInfo).toHaveBeenCalledWith("All rows already have a category")
    )
    expect(mockSuggestTransactionCategories).not.toHaveBeenCalled()
  })
})
