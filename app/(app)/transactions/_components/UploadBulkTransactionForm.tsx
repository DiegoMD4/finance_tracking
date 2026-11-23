"use client"

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Trash2Icon } from "lucide-react"
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
import { DatePickerCell } from "@/components/ui/date-picker-cell"
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
import type { DetectionInfo, ParsedTransaction } from "@/lib/parsers/types"
import {
  BulkTransactionActionState,
  DuplicatePreviewEntry,
  ImportBatchSummary,
} from "@/types/transactions.types"
import {
  checkImportBatch,
  createBulkTransactions,
  previewTransactionDuplicates,
} from "@/server/transactions/actions"
import { computeFileFingerprint } from "@/lib/transactions/file-fingerprint"
import { buildImportNotices } from "@/lib/transactions/import-notices"
import { useRouter } from "next/navigation"
import { CURRENCY_OPTIONS } from "@/lib/utils"
import { SuggestionConfidence } from "@/types/ai.types"
import { suggestTransactionCategories } from "@/server/transactions/ai-actions"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { GeminiIcon } from "@/components/icons/gemini"

interface UploadBulkTransactionFormProps {
  bankAccounts: BankAccounts[]
  categories: Category[]
  defaultCurrency: string
}

function DuplicateBadge({
  entry,
  omitDuplicates,
}: {
  entry?: DuplicatePreviewEntry
  omitDuplicates: boolean
}) {
  if (!entry) return null

  if (entry.exact) {
    return (
      <span
        title={
          omitDuplicates
            ? "This movement is already in the ledger and will be skipped"
            : "This movement is already in the ledger and will be saved again"
        }
        className="rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
      >
        {omitDuplicates ? "Already imported" : "Will be re-imported"}
      </span>
    )
  }

  if (entry.possible) {
    return (
      <span
        title="Same date, amount and type, but no reference to confirm it"
        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
      >
        Possible duplicate
      </span>
    )
  }

  return null
}

function countDuplicateReferences(items: ParsedTransaction[]): number {
  const seen = new Set<string>()
  let duplicates = 0

  for (const item of items) {
    if (!item.bankReference) continue

    const key = [
      item.bankReference,
      item.transactionDate,
      item.amount,
      item.transactionType,
    ].join("|")

    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }

  return duplicates
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
  /**
   * Warnings del parser, fijados al leer el archivo. Los avisos de duplicados
   * se derivan aparte porque cambian con la cuenta y la moneda.
   */
  const [parserWarnings, setParserWarnings] = useState<string[]>([])
  const [detection, setDetection] = useState<DetectionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [parsedSource, setParsedSource] = useState<
    "csv" | "excel" | "pdf" | "unknown" | null
  >(null)
  const [duplicateMeta, setDuplicateMeta] = useState<
    Record<string, DuplicatePreviewEntry>
  >({})
  const [importBatch, setImportBatch] = useState<ImportBatchSummary | null>(null)
  const [fileFingerprint, setFileFingerprint] = useState<string | null>(null)
  const [omitDuplicates, setOmitDuplicates] = useState(true)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  /**
   * Descarta respuestas obsoletas del preview: si se cambia de cuenta dos
   * veces, la primera respuesta no debe pisar a la segunda.
   */
  const previewRequestIdRef = useRef(0)
  const router = useRouter()
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [overwriteCategories, setOverwriteCategories] = useState(false)
  const [suggestionMeta, setSuggestionMeta] = useState<
    Record<string, { confidence: SuggestionConfidence; reason: string | null }>
  >({})
  /*   const [debugInfo, setDebugInfo] = useState<{
    fileName: string
    source: string
    rawText?: string
    transactionCount: number
  } | null>(null) */

  /**
   * Recalcula badges y avisos contra la base para la cuenta/moneda vigente.
   * Devuelve los conteos para que quien lo invoque pueda decidir los toasts;
   * los llamados por cambio de cuenta/moneda ignoran el retorno.
   */
  const runDuplicatePreview = useCallback(
    async ({
      accountId,
      rows,
      currency,
      fingerprint,
    }: {
      accountId: string
      rows: ParsedTransaction[]
      currency: string
      fingerprint: string | null
    }) => {
      if (!accountId || accountId === "none" || rows.length === 0) {
        previewRequestIdRef.current += 1
        setDuplicateMeta({})
        setImportBatch(null)
        setIsCheckingDuplicates(false)
        return null
      }

      const requestId = previewRequestIdRef.current + 1
      previewRequestIdRef.current = requestId
      setIsCheckingDuplicates(true)

      try {
        const [preview, batchResult] = await Promise.all([
          previewTransactionDuplicates({
            accountId: Number(accountId),
            currency,
            rows,
          }),
          fingerprint
            ? Promise.resolve(
                checkImportBatch({
                  accountId: Number(accountId),
                  fileHash: fingerprint,
                })
              ).catch(() => null)
            : Promise.resolve(null),
        ])

        if (previewRequestIdRef.current !== requestId) return null

        const duplicates = preview?.success ? preview.duplicates : {}
        const batch = batchResult ?? null

        setDuplicateMeta(duplicates)
        setImportBatch(batch)

        return {
          duplicates,
          exactCount: preview?.success ? preview.exactCount : 0,
          possibleCount: preview?.success ? preview.possibleCount : 0,
          batch,
        }
      } catch (error) {
        if (previewRequestIdRef.current === requestId) {
          console.error("Couldn't check for duplicates:", error)
          setDuplicateMeta({})
          setImportBatch(null)
        }

        return null
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setIsCheckingDuplicates(false)
        }
      }
    },
    []
  )

  const handleAccountChange = useCallback(
    (accountId: string) => {
      setSelectedAccountId(accountId)
      // El preview y el aviso de archivo dependen de la cuenta: se recalculan
      // en lugar de quedar vacíos hasta volver a subir el archivo.
      setDuplicateMeta({})
      setImportBatch(null)

      let currency = transactionCurrency
      if (!currencyTouched) {
        const account = bankAccounts.find((acc) => String(acc.id) === accountId)
        const accountCurrency = account?.accountCurrency
        if (
          accountCurrency &&
          CURRENCY_OPTIONS.some((option) => option.value === accountCurrency)
        ) {
          currency = accountCurrency
          setTransactionCurrency(accountCurrency)
        }
      }

      if (transactions.length > 0) {
        void runDuplicatePreview({
          accountId,
          rows: transactions,
          currency,
          fingerprint: fileFingerprint,
        })
      }
    },
    [
      bankAccounts,
      currencyTouched,
      transactionCurrency,
      transactions,
      fileFingerprint,
      runDuplicatePreview,
    ]
  )

  const handleCurrencyChange = useCallback(
    (value: string) => {
      setCurrencyTouched(true)
      setTransactionCurrency(value)

      // El chequeo "possible" compara la moneda guardada, así que el cambio
      // también obliga a refrescar.
      if (transactions.length > 0) {
        void runDuplicatePreview({
          accountId: selectedAccountId,
          rows: transactions,
          currency: value,
          fingerprint: fileFingerprint,
        })
      }
    },
    [transactions, selectedAccountId, fileFingerprint, runDuplicatePreview]
  )

  const formDispatcher = async (
    prevState: BulkTransactionActionState,
    formData: FormData
  ) => {
    formData.append("accountId", selectedAccountId)
    formData.append("transactionsJson", JSON.stringify(transactions))
    // El servidor es la fuente de verdad: aunque el cliente mande filas ya
    // importadas, solo se guardan si el checkbox está desmarcado.
    formData.append("omitDuplicates", omitDuplicates ? "true" : "false")
    // Huella del documento: solo para el aviso "este archivo ya se importó".
    formData.append("fileFingerprint", fileFingerprint ?? "")
    formData.append("fileName", file?.name ?? "")
    formData.append("fileSize", file ? String(file.size) : "")
    formData.append("sourceFormat", parsedSource ?? "")
    formData.delete("file")

    return createBulkTransactions(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

  useEffect(() => {
    if (!state) return

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
      setSuggestionMeta({})
      setErrors([])
      setParserWarnings([])
      setDetection(null)
      setDuplicateMeta({})
      setImportBatch(null)

      try {
        // Huella del archivo: se calcula antes de parsear y se reusa en el
        // preview y en el submit (los bytes no viajan al servidor).
        const fingerprint = await computeFileFingerprint(selectedFile)
        setFileFingerprint(fingerprint)

        const result = await extractTransactions(selectedFile, {
          currency: transactionCurrency,
        })

        if (result.errors.length > 0 && result.transactions.length === 0) {
          setErrors(result.errors)
          setParserWarnings(result.warnings ?? [])
          setDetection(result.detection ?? null)
          result.errors.forEach((e) => toast.error(e))
          setTransactions([])
          setParsedSource(null)
          return
        }

        setTransactions(result.transactions)
        setParsedSource(result.source)

        const info = result.detection ?? null
        setDetection(info)

        // La moneda efectiva se resuelve antes del preview: `setTransactionCurrency`
        // no cambia el valor del closure, y el snapshot se congeló con ella.
        const effectiveCurrency =
          info?.currency &&
          CURRENCY_OPTIONS.some((option) => option.value === info.currency)
            ? info.currency
            : transactionCurrency

        // Duplicados propios del archivo: no dependen de la cuenta, así que
        // viven junto a los warnings del parser.
        const internalDuplicates = countDuplicateReferences(result.transactions)
        const parserNotices = [...(result.warnings ?? [])]

        if (internalDuplicates > 0) {
          parserNotices.unshift(
            `${internalDuplicates} possible duplicate${
              internalDuplicates === 1 ? "" : "s"
            } with the same reference, date and amount`
          )
        }

        setParserWarnings(parserNotices)

        // Chequeo contra la base: exactos, posibles y aviso de archivo repetido.
        const preview = await runDuplicatePreview({
          accountId: selectedAccountId,
          rows: result.transactions,
          currency: effectiveCurrency,
          fingerprint,
        })

        const notices = buildImportNotices({
          parserWarnings: parserNotices,
          duplicateMeta: preview?.duplicates ?? {},
          omitDuplicates,
          batch: preview?.batch ?? null,
        })

        notices.slice(0, 3).forEach((notice) => toast.warning(notice))

        if (
          !currencyTouched &&
          info?.currency &&
          CURRENCY_OPTIONS.some((option) => option.value === info.currency)
        ) {
          setTransactionCurrency(info.currency)
        }

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
    [selectedAccountId, currencyTouched, transactionCurrency, omitDuplicates, runDuplicatePreview]
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
    setParserWarnings([])
    setDetection(null)
    setSuggestionMeta({})
    setDuplicateMeta({})
    setImportBatch(null)
    setFileFingerprint(null)
    // Invalida cualquier preview en vuelo: sus badges ya no corresponden.
    previewRequestIdRef.current += 1
    setIsCheckingDuplicates(false)
  }, [])

  const hasTransactions = transactions.length > 0

  /**
   * Los avisos se derivan del estado: al refrescar el preview (cuenta o
   * moneda) se recalculan solos, sin arrastrar textos viejos.
   */
  const notices = useMemo(
    () =>
      buildImportNotices({
        parserWarnings,
        duplicateMeta,
        omitDuplicates,
        batch: importBatch,
      }),
    [parserWarnings, duplicateMeta, omitDuplicates, importBatch]
  )

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

  const handleSuggestCategories = useCallback(async () => {
    const candidates = transactions.filter(
      (tx) =>
        tx.transactionDescription.trim().length > 0 &&
        (overwriteCategories || !tx.categoryId)
    )
    if (candidates.length === 0) {
      toast.info("All rows already have a category")
      return
    }
    setIsSuggesting(true)
    try {
      const result = await suggestTransactionCategories(
        candidates.map((tx) => ({
          tempId: tx.tempId,
          transactionDescription: tx.transactionDescription,
          transactionType: tx.transactionType,
          amount: tx.amount,
        }))
      )
      if (!result.success) {
        toast.error(result.message)
        return
      }
      const currentById = new Map(transactions.map((tx) => [tx.tempId, tx]))
      const applicable = new Map<string, string>()
      for (const suggestion of result.suggestions) {
        if (suggestion.categoryId === null) continue
        const current = currentById.get(suggestion.tempId)
        if (!current) continue
        if (!overwriteCategories && current.categoryId) continue
        applicable.set(suggestion.tempId, suggestion.categoryId)
      }
      setTransactions((prev) =>
        prev.map((tx) => {
          const categoryId = applicable.get(tx.tempId)
          return categoryId ? { ...tx, categoryId } : tx
        })
      )
      setSuggestionMeta((prev) => {
        const next = { ...prev }
        for (const suggestion of result.suggestions) {
          next[suggestion.tempId] = {
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          }
        }
        return next
      })
    } catch (error) {
      console.error(error)
      toast.error("Could not reach the AI service")
    } finally {
      setIsSuggesting(false)
    }
  }, [transactions, overwriteCategories])

  return (
    <form
      className="flex w-full flex-col gap-6"
      autoComplete="off"
      action={formAction}
    >
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
              onValueChange={handleCurrencyChange}
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
          {/* <button type="button" onClick={() => handleGemini()}>
            Call Gemini
          </button> */}
        </FieldGroup>
        <FieldError />
      </Field>

      {/* Paso 2: Dropzone */}
      <Field>
        <FieldLabel>Bank statement file</FieldLabel>
        <FieldDescription>
          Upload a PDF, Excel or CSV bank statement from any bank. Movements
          will be read and you can review them before saving.
        </FieldDescription>
        <Dropzone
          name="file"
          accept=".csv,.xlsx,.xls,.pdf"
          maxFiles={1}
          label="Drag your file here"
          disabled={
            isLoading || isPending || !selectedAccountId || isSuggesting
          }
          onChange={handleFileChange}
          onRemove={clearAll}
          hideOnFile
        />
        <FieldError />
      </Field>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Processing file…
        </div>
      )}

      {hasTransactions && (
        <section className="flex w-full flex-col gap-4 border-t pt-4">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-semibold">
              Detected transactions ({transactions.length})
            </h2>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  size="sm"
                  checked={overwriteCategories}
                  onCheckedChange={setOverwriteCategories}
                  disabled={isSuggesting}
                />
                Overwrite existing
              </label>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={omitDuplicates}
                  onChange={(event) => setOmitDuplicates(event.target.checked)}
                  disabled={isLoading || isPending || isCheckingDuplicates}
                />
                Omit exact duplicates
              </label>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSuggestCategories}
                disabled={isLoading || isPending || isSuggesting}
                className="w-full cursor-pointer sm:w-auto"
              >
                {isSuggesting ? <Spinner /> : <GeminiIcon />}
                {isSuggesting ? "Suggesting..." : "Suggest categories with AI"}
              </Button>
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
                disabled={
                  isLoading || isPending || isSuggesting || isCheckingDuplicates
                }
                className="w-full cursor-pointer sm:w-auto"
              >
                Save transactions
              </Button>
            </div>
          </div>

          {isCheckingDuplicates && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Checking for duplicates…
            </div>
          )}

          {(detection || parsedSource) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                Format: {detection?.format ?? parsedSource}
              </span>
              {detection?.bank && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Bank: {detection.bank}
                </span>
              )}
              {detection?.currency && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Currency: {detection.currency}
                </span>
              )}
              {detection?.sheetName && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Sheet: {detection.sheetName}
                </span>
              )}
              {detection?.delimiter && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Delimiter:{" "}
                  {detection.delimiter === "\t" ? "tab" : detection.delimiter}
                </span>
              )}
              {detection?.headerRow != null && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Header row: {detection.headerRow}
                </span>
              )}
              {detection && detection.confidence > 0 && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Confidence: {Math.round(detection.confidence * 100)}%
                </span>
              )}
              {detection?.balanceChecked && (
                <span className="rounded-full border bg-muted/40 px-2 py-0.5">
                  Balance verified
                </span>
              )}
            </div>
          )}

          {notices.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-700 dark:text-amber-400">
              <p className="mb-1 font-medium">Review these notices:</p>
              {notices.map((notice, index) => (
                <div key={`${notice}-${index}`} className="mb-1 last:mb-0">
                  • {notice}
                </div>
              ))}
            </div>
          )}

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
              <p className="mb-1 font-medium">Rows that could not be saved:</p>
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
                  <TableHead className="w-[24%]">Description</TableHead>
                  <TableHead className="w-[12%]">Type</TableHead>
                  <TableHead className="w-[12%]">Amount</TableHead>
                  <TableHead className="w-[16%]">Bank reference</TableHead>
                  <TableHead className="w-[10%]">Category</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[8%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.tempId}>
                    <TableCell>
                      <DatePickerCell
                        value={tx.transactionDate}
                        onChange={(date) =>
                          updateTransaction(tx.tempId, {
                            transactionDate: date,
                          })
                        }
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
                      <div className="flex items-center gap-1">
                        <Select
                          value={tx.categoryId ?? "none"}
                          onValueChange={(v) => {
                            updateTransaction(tx.tempId, {
                              categoryId:
                                v === "none" ? undefined : v || undefined,
                            })
                            setSuggestionMeta((prev) => {
                              if (!prev[tx.tempId]) return prev
                              const next = { ...prev }
                              delete next[tx.tempId]
                              return next
                            })
                          }}
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
                        {tx.categoryId && suggestionMeta[tx.tempId] && (
                          <span
                            title={
                              suggestionMeta[tx.tempId].reason ??
                              "Suggested by AI"
                            }
                            className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            IA
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DuplicateBadge
                        entry={duplicateMeta[tx.tempId]}
                        omitDuplicates={omitDuplicates}
                      />
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
                        <Trash2Icon className="h-4 w-4 text-destructive" />
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
