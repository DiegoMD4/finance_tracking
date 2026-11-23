import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import React from "react"
import { createBulkTransactions, checkImportBatch, previewTransactionDuplicates } from "@/server/transactions/actions"
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

// La huella real depende de `crypto.subtle`; en el test se fija para poder
// verificar que viaja al servidor y que dispara la consulta del lote.
vi.mock("@/lib/transactions/file-fingerprint", () => ({
  computeFileFingerprint: vi.fn(async () => "a".repeat(64)),
  isValidFileFingerprint: (value: unknown) =>
    typeof value === "string" && /^[0-9a-f]{64}$/.test(value),
}))

vi.mock("@/server/transactions/ai-actions", () => ({
  suggestTransactionCategories: vi.fn(),
}))

// Las server actions se reemplazan: el test no debe tocar la base ni la sesión.
vi.mock("@/server/transactions/actions", () => ({
  createBulkTransactions: vi.fn(),
  previewTransactionDuplicates: vi.fn(),
  checkImportBatch: vi.fn(),
}))

const mockCreateBulkTransactions = vi.mocked(createBulkTransactions)
const mockPreviewDuplicates = vi.mocked(previewTransactionDuplicates)
const mockCheckImportBatch = vi.mocked(checkImportBatch)
const mockExtractTransactions = vi.mocked(extractTransactions)
const mockSuggestTransactionCategories = vi.mocked(suggestTransactionCategories)

const bankAccounts: BankAccounts[] = [
  { id: 1, bankName: "Banco Atlántida", accountName: "Savings", accountCurrency: "HNL" } as BankAccounts,
]

const secondAccount: BankAccounts = {
  id: 2,
  bankName: "Banco Atlántida",
  accountName: "Checking",
  accountCurrency: "USD",
} as BankAccounts

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
      skipped: 0,
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
  dedupe: {
    original: {
      date: "2025-10-01",
      amount: "25.50",
      type: "expense",
      reference: "REF-001",
      description: "Supermarket purchase",
      currency: "HNL",
    },
    occurrence: 1,
  },
  ...overrides,
})

// Selecciona la cuenta y sube un archivo que devuelve las filas indicadas.
async function uploadParsed(
  user: ReturnType<typeof userEvent.setup>,
  parsed: ParsedTransaction[],
  preview: Awaited<ReturnType<typeof previewTransactionDuplicates>> = {
    success: true,
    duplicates: {},
    exactCount: 0,
    possibleCount: 0,
  }
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
  mockPreviewDuplicates.mockResolvedValueOnce(preview)

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

describe("UploadBulkTransactionForm - duplicados contra la base", () => {
  const exactPreview = {
    success: true,
    duplicates: { "1": { exact: true, possible: false } },
    exactCount: 1,
    possibleCount: 0,
  }

  const possiblePreview = {
    success: true,
    duplicates: { "1": { exact: false, possible: true } },
    exactCount: 0,
    possibleCount: 1,
  }

  it("pide el preview con la cuenta, la moneda y las filas", async () => {
    const user = userEvent.setup()
    renderForm()
    await uploadParsed(user, [parsedRow()])

    expect(mockPreviewDuplicates).toHaveBeenCalledWith({
      accountId: 1,
      currency: "HNL",
      rows: [expect.objectContaining({ tempId: "1" })],
    })
  })

  it("marca la fila ya importada y la omite por defecto", async () => {
    const user = userEvent.setup()
    renderForm()
    await uploadParsed(user, [parsedRow()], exactPreview)

    expect(
      await within(document.body).findByText("Already imported")
    ).toBeInTheDocument()

    // El checkbox "omitir duplicados exactos" viene activo
    const omitCheckbox = within(document.body).getByRole("checkbox") as HTMLInputElement
    expect(omitCheckbox.checked).toBe(true)

    mockCreateBulkTransactions.mockResolvedValueOnce({
      success: true,
      message: "1 transaction was already imported",
      saved: 0,
      skipped: 1,
      failed: 0,
      rows: [],
      savedTempIds: ["1"],
    } as Awaited<ReturnType<typeof createBulkTransactions>>)

    fireEvent.click(
      within(document.body).getByRole("button", { name: /save transactions/i })
    )

    await waitFor(() => expect(mockCreateBulkTransactions).toHaveBeenCalled())

    const formData = mockCreateBulkTransactions.mock.calls[0][1]
    expect(formData.get("omitDuplicates")).toBe("true")
    // La fila se envía igual: el servidor es la fuente de verdad
    expect(JSON.parse(String(formData.get("transactionsJson")))).toHaveLength(1)
  })

  it("desmarcar el checkbox permite reimportar la fila", async () => {
    const user = userEvent.setup()
    renderForm()
    await uploadParsed(user, [parsedRow()], exactPreview)

    // El checkbox está deshabilitado mientras corre el preview: se espera el
    // badge para no hacer click en un control inerte.
    await within(document.body).findByText("Already imported")

    const omitCheckbox = within(document.body).getByRole("checkbox") as HTMLInputElement
    await user.click(omitCheckbox)


    expect(
      await within(document.body).findByText("Will be re-imported")
    ).toBeInTheDocument()

    mockCreateBulkTransactions.mockResolvedValueOnce({
      success: true,
      message: "Saved 1 transaction successfully",
      saved: 1,
      skipped: 0,
      failed: 0,
      rows: [],
      savedTempIds: ["1"],
    } as Awaited<ReturnType<typeof createBulkTransactions>>)

    fireEvent.click(
      within(document.body).getByRole("button", { name: /save transactions/i })
    )

    await waitFor(() => expect(mockCreateBulkTransactions).toHaveBeenCalled())
    expect(mockCreateBulkTransactions.mock.calls[0][1].get("omitDuplicates")).toBe(
      "false"
    )
  })

  it("advierte un duplicado posible sin bloquear el guardado", async () => {
    const user = userEvent.setup()
    renderForm()
    await uploadParsed(user, [parsedRow()], possiblePreview)

    expect(
      await within(document.body).findByText("Possible duplicate")
    ).toBeInTheDocument()

    const omitCheckbox = within(document.body).getByRole("checkbox") as HTMLInputElement
    expect(omitCheckbox.checked).toBe(true)

    expect(
      within(document.body).getByRole("button", { name: /save transactions/i })
    ).toBeEnabled()
  })
})

describe("UploadBulkTransactionForm - archivo ya importado y refresco del preview", () => {
  const batchSummary = {
    id: 7,
    accountId: 1,
    accountName: "Savings",
    fileName: "statement.csv",
    fileHash: "a".repeat(64),
    fileSize: 1024,
    sourceFormat: "csv",
    rowCount: 1,
    savedCount: 1,
    skippedCount: 0,
    failedCount: 0,
    createdAt: new Date("2026-10-14T12:00:00.000Z"),
    undoneAt: null,
  }

  const exactPreview = {
    success: true,
    duplicates: { "1": { exact: true, possible: false } },
    exactCount: 1,
    possibleCount: 0,
  }

  const emptyPreview = {
    success: true,
    duplicates: {},
    exactCount: 0,
    possibleCount: 0,
  }

  async function selectAccount(
    user: ReturnType<typeof userEvent.setup>,
    optionName: RegExp
  ) {
    await user.click(document.getElementById("bankAccount") as HTMLElement)
    const option = await within(document.body).findByRole("option", {
      name: optionName,
    })
    await user.click(option)
  }

  it("UI-01: avisa que el archivo ya se importó y no bloquea el guardado", async () => {
    const user = userEvent.setup()
    mockCheckImportBatch.mockResolvedValueOnce(batchSummary)

    renderForm()
    await uploadParsed(user, [parsedRow()])

    expect(
      await within(document.body).findByText(
        /This file was already imported on 14\/10\/2026/i
      )
    ).toBeInTheDocument()
    expect(mockCheckImportBatch).toHaveBeenCalledWith({
      accountId: 1,
      fileHash: "a".repeat(64),
    })
    expect(mockToastWarning).toHaveBeenCalledWith(
      expect.stringContaining("already imported on 14/10/2026")
    )
    expect(
      within(document.body).getByRole("button", { name: /save transactions/i })
    ).toBeEnabled()
  })

  it("UI-02: al cambiar de cuenta se vuelve a consultar el preview", async () => {
    const user = userEvent.setup()
    renderForm({ bankAccounts: [bankAccounts[0], secondAccount] })

    await uploadParsed(user, [parsedRow()], emptyPreview)
    expect(
      within(document.body).queryByText("Already imported")
    ).not.toBeInTheDocument()

    mockPreviewDuplicates.mockResolvedValueOnce(exactPreview)
    await selectAccount(user, /Checking \(USD\)/i)

    expect(
      await within(document.body).findByText("Already imported")
    ).toBeInTheDocument()
    expect(mockPreviewDuplicates).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: 2, currency: "USD" })
    )
  })

  it("UI-03: al cambiar la moneda se vuelve a consultar el preview", async () => {
    const user = userEvent.setup()
    renderForm()

    await uploadParsed(user, [parsedRow()], emptyPreview)

    mockPreviewDuplicates.mockResolvedValueOnce({
      success: true,
      duplicates: { "1": { exact: false, possible: true } },
      exactCount: 0,
      possibleCount: 1,
    })

    await user.click(document.getElementById("transactionCurrency") as HTMLElement)
    await user.click(await within(document.body).findByRole("option", { name: /USD/i }))

    expect(
      await within(document.body).findByText("Possible duplicate")
    ).toBeInTheDocument()
    expect(mockPreviewDuplicates).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: "USD" })
    )
  })

  it("UI-04: la fila viaja al servidor con su snapshot de dedupe", async () => {
    const user = userEvent.setup()
    renderForm()
    await uploadParsed(user, [parsedRow()])

    mockCreateBulkTransactions.mockResolvedValueOnce({
      success: true,
      message: "Saved 1 transaction successfully",
      saved: 1,
      skipped: 0,
      failed: 0,
      rows: [],
      savedTempIds: ["1"],
    } as Awaited<ReturnType<typeof createBulkTransactions>>)

    fireEvent.click(
      within(document.body).getByRole("button", { name: /save transactions/i })
    )

    await waitFor(() => expect(mockCreateBulkTransactions).toHaveBeenCalled())

    const formData = mockCreateBulkTransactions.mock.calls[0][1]
    const payload = JSON.parse(String(formData.get("transactionsJson")))
    expect(payload[0].dedupe).toEqual({
      original: expect.objectContaining({
        date: "2025-10-01",
        amount: "25.50",
        currency: "HNL",
      }),
      occurrence: 1,
    })

    // Y: la huella del archivo también viaja
    expect(formData.get("fileFingerprint")).toBe("a".repeat(64))
    expect(formData.get("fileName")).toBe("test.csv")
    expect(formData.get("sourceFormat")).toBe("csv")
  })

  it("UI-05: una respuesta vieja del preview no pisa a la nueva", async () => {
    const user = userEvent.setup()
    renderForm({ bankAccounts: [bankAccounts[0], secondAccount] })

    await uploadParsed(user, [parsedRow()], emptyPreview)

    // Segunda consulta (cuenta 2): queda colgada a propósito
    let resolveStale: (value: typeof emptyPreview) => void = () => {}
    mockPreviewDuplicates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve
        })
    )
    await selectAccount(user, /Checking \(USD\)/i)

    // Tercera consulta (volver a la cuenta 1): responde exacto
    mockPreviewDuplicates.mockResolvedValueOnce(exactPreview)
    await selectAccount(user, /Savings \(HNL\)/i)

    expect(
      await within(document.body).findByText("Already imported")
    ).toBeInTheDocument()

    // Llega la respuesta vieja: el badge debe seguir
    resolveStale(emptyPreview)
    await waitFor(() =>
      expect(mockPreviewDuplicates).toHaveBeenCalledTimes(3)
    )
    expect(
      within(document.body).getByText("Already imported")
    ).toBeInTheDocument()
  })
})
