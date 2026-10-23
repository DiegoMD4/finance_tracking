"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Dropzone } from "@/components/ui/dropzone"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BankAccounts } from "@/types/bank-accounts.types"
import type { Category } from "@/types/categories.types"
import {
  extractTransactions,
  /* getFileSource, */
} from "@/lib/parsers/file-extractor"
import type { ParsedTransaction } from "@/lib/parsers/types"
import { BulkTransactionActionState } from "@/types/transactions.types"
import { createBulkTransactions } from "@/server/transactions/actions"
import { useRouter } from "next/navigation"
import { CURRENCY_OPTIONS } from "@/lib/utils"

interface UploadBulkTransactionFormProps {
  bankAccounts: BankAccounts[]
  categories: Category[]
  defaultCurrency: string
}

export function UploadBulkTransactionForm({
  bankAccounts,
  categories,
  defaultCurrency,
}: UploadBulkTransactionFormProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [transactionCurrency, setTransactionCurrency] = useState<string>(() =>
    CURRENCY_OPTIONS.some((option) => option.value === defaultCurrency)
      ? defaultCurrency
      : "HNL"
  )
  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [parsedSource, setParsedSource] = useState<
    "csv" | "excel" | "pdf" | "unknown" | null
  >(null)
  const router = useRouter()
  /*   const [debugInfo, setDebugInfo] = useState<{
    fileName: string
    source: string
    rawText?: string
    transactionCount: number
  } | null>(null) */

  const handleAccountChange = useCallback(
    (accountId: string) => {
      setSelectedAccountId(accountId)

      // Si el usuario aún no eligió moneda, se propone la de la cuenta.
      if (currencyTouched) return
      const account = bankAccounts.find((acc) => String(acc.id) === accountId)
      const accountCurrency = account?.accountCurrency
      if (
        accountCurrency &&
        CURRENCY_OPTIONS.some((option) => option.value === accountCurrency)
      ) {
        setTransactionCurrency(accountCurrency)
      }
    },
    [bankAccounts, currencyTouched]
  )

  const formDispatcher = async (
    prevState: BulkTransactionActionState,
    formData: FormData
  ) => {
    formData.append("accountId", selectedAccountId)
    formData.append("transactionsJson", JSON.stringify(transactions))
    formData.delete("file")

    return createBulkTransactions(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

  useEffect(() => {
    if (!state) return

    // Quita de la tabla lo que ya quedó guardado: si el guardado fue parcial,
    // un reintento solo reenviaría las filas pendientes.
    if (state.savedTempIds.length > 0) {
      const savedTempIds = new Set(state.savedTempIds)
      setTransactions((prev) => {
        const remaining = prev.filter((tx) => !savedTempIds.has(tx.tempId))
        return remaining.length === prev.length ? prev : remaining
      })
    }

    if (state.success) {
      toast.success(state.message)
      router.push("/transactions")
      return
    }

    toast.error(state.message)
  }, [state, router])

  const handleFileChange = useCallback(
    async (files: File[]) => {
      const selectedFile = files[0]
      if (!selectedFile) return
      if (!selectedAccountId || selectedAccountId === "none") {
        toast.error("Select a bank account before uploading the file")
        setFile(null)
        return
      }

      setFile(selectedFile)
      setIsLoading(true)
      setErrors([])

      try {
        const result = await extractTransactions(selectedFile)

        if (result.errors.length > 0 && result.transactions.length === 0) {
          setErrors(result.errors)
          result.errors.forEach((e) => toast.error(e))
          setTransactions([])
          setParsedSource(null)
          /* setDebugInfo({
            fileName: result.fileName,
            source: result.source,
            rawText: result.rawText,
            transactionCount: 0,
          }) */
          return
        }

        setTransactions(result.transactions)
        setParsedSource(result.source)
        /*  setDebugInfo({
          fileName: result.fileName,
          source: result.source,
          rawText: result.rawText,
          transactionCount: result.transactions.length,
        }) */
        if (result.errors.length > 0) {
          result.errors.forEach((e) => toast.warning(e))
        }
        toast.success(
          `Extracted ${result.transactions.length} transaction${
            result.transactions.length !== 1 ? "s" : ""
          } from file`
        )
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error reading file"
        setErrors([msg])
        toast.error(msg)
        /*  setDebugInfo({
          fileName: selectedFile.name,
          source: getFileSource(selectedFile.name),
          rawText: undefined,
          transactionCount: 0,
        }) */
      } finally {
        setIsLoading(false)
      }
    },
    [selectedAccountId]
  )

  const updateTransaction = useCallback(
    (tempId: string, updates: Partial<ParsedTransaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.tempId === tempId ? { ...t, ...updates } : t))
      )
    },
    []
  )

  const removeTransaction = useCallback((tempId: string) => {
    setTransactions((prev) => prev.filter((t) => t.tempId !== tempId))
  }, [])

  const clearAll = useCallback(() => {
    setTransactions([])
    setFile(null)
    setParsedSource(null)
    setErrors([])
  }, [])

  const hasTransactions = transactions.length > 0

  // Errores de la última ejecución, solo para filas que siguen en la tabla.
  const failedRows = (() => {
    if (!state?.rows.length) return []
    const currentTempIds = new Set(transactions.map((tx) => tx.tempId))
    const seen = new Set<string>()

    return state.rows.filter((row) => {
      if (
        row.success ||
        !currentTempIds.has(row.tempId) ||
        seen.has(row.tempId)
      ) {
        return false
      }

      seen.add(row.tempId)
      return true
    })
  })()

  return (
    <form
      className="flex w-full flex-col gap-6"
      autoComplete="off"
      action={formAction}
    >
      {/* Paso 1: Seleccionar cuenta bancaria */}
      <Field>
        <FieldLabel>Destination bank account</FieldLabel>
        <FieldDescription>
          Choose the account where imported transactions will be registered.
        </FieldDescription>
        <FieldGroup className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bankAccount">Bank account</FieldLabel>
            <Select
              value={selectedAccountId}
              onValueChange={handleAccountChange}
              disabled={isLoading || isPending}
            >
              <SelectTrigger id="bankAccount">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.length === 0 ? (
                  <SelectItem disabled value="none">
                    No bank accounts available
                  </SelectItem>
                ) : (
                  bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.bankName} - {acc.accountName || "Unnamed account"}
                      {acc.accountCurrency ? ` (${acc.accountCurrency})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="transactionCurrency">Currency</FieldLabel>
            <Select
              name="transactionCurrency"
              value={transactionCurrency}
              onValueChange={(value) => {
                setCurrencyTouched(true)
                setTransactionCurrency(value)
              }}
              disabled={isLoading || isPending}
            >
              <SelectTrigger id="transactionCurrency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Applied to every transaction in this upload.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <FieldError />
      </Field>

      {/* Paso 2: Dropzone */}
      <Field>
        <FieldLabel>Bank statement file</FieldLabel>
        <FieldDescription>
          Upload a PDF, Excel or CSV generated by Banco Atlántida. Movements
          will be read and you can review them before saving.
        </FieldDescription>
        <Dropzone
          name="file"
          accept=".csv,.xlsx,.xls,.pdf"
          maxFiles={1}
          label="Drag your file here"
          disabled={isLoading || isPending || !selectedAccountId}
          onChange={handleFileChange}
        />
        <FieldError />
      </Field>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Processing file…
        </div>
      )}

      {/* Paso 3: Tabla de vista previa editable */}
      {hasTransactions && (
        <section className="flex w-full flex-col gap-4 border-t pt-4">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">
              Detected transactions ({transactions.length}) - parser used:{" "}
              {parsedSource}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isLoading || isPending}
                className="w-full cursor-pointer sm:w-auto"
              >
                Clear table
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || isPending}
                className="w-full cursor-pointer sm:w-auto"
              >
                Save transactions
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-[12px] text-destructive">
              {errors.map((e, i) => (
                <div key={i} className="mb-1 last:mb-0">
                  • {e}
                </div>
              ))}
            </div>
          )}

          {failedRows.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-[12px] text-destructive">
              <p className="mb-1 font-medium">
                Rows that could not be saved:
              </p>
              {failedRows.map((row) => (
                <div key={row.tempId} className="mb-1 last:mb-0">
                  • Row {row.row ?? "?"}: {row.error ?? "Unknown error"}
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%]">Date</TableHead>
                  <TableHead className="w-[26%]">Description</TableHead>
                  <TableHead className="w-[14%]">Type</TableHead>
                  <TableHead className="w-[14%]">Amount</TableHead>
                  <TableHead className="w-[18%]">Bank reference</TableHead>
                  <TableHead className="w-[12%]">Category</TableHead>
                  <TableHead className="w-[8%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.tempId}>
                    <TableCell>
                      <Input
                        type="date"
                        value={tx.transactionDate}
                        onChange={(e) =>
                          updateTransaction(tx.tempId, {
                            transactionDate: e.target.value,
                          })
                        }
                        className="h-8 border-none bg-transparent p-0 text-xs focus:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={tx.transactionDescription}
                        onChange={(e) =>
                          updateTransaction(tx.tempId, {
                            transactionDescription: e.target.value,
                          })
                        }
                        className="h-8 border-none bg-transparent p-0 text-xs focus:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.transactionType}
                        onValueChange={(v) =>
                          updateTransaction(tx.tempId, {
                            transactionType: v as "income" | "expense",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent p-0 text-xs focus:ring-0">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">
                            Income (Credit)
                          </SelectItem>
                          <SelectItem value="expense">
                            Expense (Debit)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={tx.amount}
                        onChange={(e) =>
                          updateTransaction(tx.tempId, {
                            amount: e.target.value,
                          })
                        }
                        className="h-8 border-none bg-transparent p-0 text-right font-mono text-xs focus:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={tx.bankReference ?? ""}
                        onChange={(e) =>
                          updateTransaction(tx.tempId, {
                            bankReference: e.target.value || null,
                          })
                        }
                        className="h-8 border-none bg-transparent p-0 font-mono text-xs text-muted-foreground focus:ring-0"
                        placeholder="No reference"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.categoryId ?? "none"}
                        onValueChange={(v) =>
                          updateTransaction(tx.tempId, {
                            categoryId:
                              v === "none" ? undefined : v || undefined,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent p-0 text-xs focus:ring-0">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {categories.map((c) => (
                            <SelectItem
                              key={c.categoryId}
                              value={String(c.categoryId)}
                            >
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTransaction(tx.tempId)}
                        disabled={isLoading}
                        aria-label={`Remove ${tx.transactionDescription}`}
                      >
                        <span className="sr-only">Remove</span>
                        <span className="text-destructive">×</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {!hasTransactions && !file && !isLoading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          Select an account and upload a file to get started.
        </div>
      )}
      {/* 
      {debugInfo && (
        <details className="mt-6 border border-muted/30 rounded-md p-4 text-xs bg-muted/50">
          <summary className="font-semibold text-muted-foreground cursor-pointer">
            Debug info (raw extracted text)
          </summary>
          <div className="mt-2 text-muted-foreground break-all whitespace-pre-wrap font-mono text-[10px]">
            {debugInfo.rawText ?? "(no text extracted)"}
          </div>
        </details>
      )} */}
    </form>
  )
}
