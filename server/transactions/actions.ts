"use server"

import {
  transactionSchema,
  transactionCurrencySchema,
  bulkTransactionSchema,
  dedupeSnapshotSchema,
} from "@/app/(app)/transactions/schema"
import { db } from "@/db"
import { transactions } from "@/db/schema/schema"
import { getDefaultCategory } from "@/server/categories/queries"
import { getBankAccountById } from "@/server/bank-accounts/queries"
import { getUserById } from "@/server/users/queries"
import {
  getDedupeKeysByHashes,
  getTransactionsInDateRange,
} from "@/server/transactions/queries"
import {
  TransactionsActionState,
  CreateTransaction,
  UpdateTransaction,
  BulkTransactionResult,
  BulkTransactionActionState,
  BulkTransactionInput,
  BulkTransactionRawInput,
  BulkTransactionRowResult,
  DuplicatePreviewEntry,
  DuplicatePreviewResult,
} from "@/types/transactions.types"

import { eq, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"
import { getSessionUserId } from "@/lib/jwt"
import { getExchangeRate } from "@/lib/currency"
import { buildDedupeHash } from "@/lib/transactions/dedupe-hash"
import { canonicalAmount, normalizeForHash } from "@/lib/transactions/dedupe"

const resolveCategoryId = async (rawCategoryId: string, userId: number) => {
  const parsedCategoryId = Number(rawCategoryId)

  if (parsedCategoryId) {
    return parsedCategoryId
  }

  const defaultCategory = await getDefaultCategory(userId)

  return defaultCategory.ok ? defaultCategory.data : parsedCategoryId
}

export const createTransaction = async (
  prevState: TransactionsActionState,
  formData: FormData
): Promise<CreateTransaction | undefined> => {
  const rawFields = {
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    categoryId: formData.get("categoryId")?.toString() || "",
    transactionDate: formData.get("transactionDate")?.toString() || "",
    transactionCurrency:
      formData.get("transactionCurrency")?.toString() || "HNL",
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      fields: rawFields,
    }
  }

  const validatedFields = transactionSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
        transactionDate: fieldErrors.properties?.transactionDate?.errors[0],
        transactionCurrency:
          fieldErrors.properties?.transactionCurrency?.errors[0],
      },
      fields: rawFields,
    }
  }

  const {
    accountId,
    amount,
    transactionType,
    transactionDescription,
    transactionDate,
    transactionCurrency,
  } = validatedFields.data

  // La cuenta debe existir y pertenecer al usuario de la sesión.
  const accountResult = await getBankAccountById({ id: accountId })
  if (!accountResult.ok) {
    return {
      success: false,
      message: accountResult.error.message,
      fields: rawFields,
    }
  }

  // Obtener moneda por defecto del usuario desde la sesión (no del cliente)
  const userResult = await getUserById(userId)
  const defaultCurrency = userResult.success
    ? (userResult.data?.defaultCurrency ?? "HNL")
    : "HNL"

  let exchangeRate = 1
  let amountInDefaultCurrency = Number(amount)

  if (transactionCurrency !== defaultCurrency) {
    try {
      exchangeRate = await getExchangeRate(transactionCurrency, defaultCurrency)
      amountInDefaultCurrency = Number(amount) * exchangeRate
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      return { success: false, message: errorMessage, fields: rawFields }
    }
  }

  try {
    await db.insert(transactions).values({
      userId,
      accountId,
      amount,
      transactionCurrency,
      exchangeRate: exchangeRate.toFixed(6),
      amountInDefaultCurrency: amountInDefaultCurrency.toFixed(2),
      defaultCurrencyAtTransaction: defaultCurrency,
      transactionType,
      transactionDescription,
      transactionDate,
      categoryId: await resolveCategoryId(rawFields.categoryId, userId),
    })

    revalidatePath("/transactions")

    return {
      success: true,
      message: "Transaction created successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("Error creating transaction:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export const deleteTransaction = async (id: number) => {
  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
    }
  }

  try {
    const [deleteResult] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

    if (deleteResult.affectedRows === 0) {
      return { success: false, message: "Transaction not found" }
    }

    revalidatePath("/transactions")

    return { success: true, message: "Transaction deleted" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return { success: false, message: errorMessage }
  }
}

export const updateTransaction = async (
  prevState: TransactionsActionState,
  formData: FormData
): Promise<UpdateTransaction | undefined> => {
  const idRaw = formData.get("id")?.toString()
  const transactionId = idRaw ? parseInt(idRaw, 10) : null
  const rawFields = {
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    categoryId: formData.get("categoryId")?.toString() || "",
    transactionDate: formData.get("transactionDate")?.toString() || "",
    transactionCurrency:
      formData.get("transactionCurrency")?.toString() || "HNL",
  }

  if (!transactionId || isNaN(transactionId)) {
    return {
      success: false,
      message: "Missing or invalid transaction ID",
      fields: rawFields,
    }
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      fields: rawFields,
    }
  }

  const validatedFields = transactionSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
        transactionDate: fieldErrors.properties?.transactionDate?.errors[0],
        transactionCurrency:
          fieldErrors.properties?.transactionCurrency?.errors[0],
      },
      fields: rawFields,
    }
  }

  const {
    accountId,
    amount,
    transactionType,
    transactionDescription,
    transactionDate,
    transactionCurrency,
  } = validatedFields.data

  // La cuenta debe existir y pertenecer al usuario de la sesión.
  const accountResult = await getBankAccountById({ id: accountId })
  if (!accountResult.ok) {
    return {
      success: false,
      message: accountResult.error.message,
      fields: rawFields,
    }
  }

  // Obtener moneda por defecto del usuario desde la sesión (no del cliente)
  const userResult = await getUserById(userId)
  const defaultCurrency = userResult.success
    ? (userResult.data?.defaultCurrency ?? "HNL")
    : "HNL"

  let exchangeRate = 1
  let amountInDefaultCurrency = Number(amount)

  if (transactionCurrency !== defaultCurrency) {
    try {
      exchangeRate = await getExchangeRate(transactionCurrency, defaultCurrency)
      amountInDefaultCurrency = Number(amount) * exchangeRate
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      return { success: false, message: errorMessage, fields: rawFields }
    }
  }

  try {
    await db
      .update(transactions)
      .set({
        accountId,
        amount,
        transactionCurrency,
        exchangeRate: exchangeRate.toFixed(6),
        amountInDefaultCurrency: amountInDefaultCurrency.toFixed(2),
        defaultCurrencyAtTransaction: defaultCurrency,
        transactionType,
        transactionDescription,
        transactionDate,
        categoryId: await resolveCategoryId(rawFields.categoryId, userId),
      })
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
      )

    revalidatePath("/transactions")

    return {
      success: true,
      message: "Transaction updated successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("Error updating transaction:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

const CHUNK_SIZE = 100

const buildBulkMessage = (
  saved: number,
  skipped: number,
  failed: number
): string => {
  const savedText = `Saved ${saved} transaction${saved === 1 ? "" : "s"}`

  if (failed === 0 && skipped === 0) return `${savedText} successfully`

  if (saved === 0 && failed === 0) {
    return `${skipped} transaction${
      skipped === 1 ? " was" : "s were"
    } already imported`
  }

  const parts = [savedText]
  if (skipped > 0) {
    parts.push(
      `${skipped} skipped as duplicate${skipped === 1 ? "" : "s"}`
    )
  }
  if (failed > 0) parts.push(`${failed} failed`)

  return parts.join(", ")
}

export const createBulkTransactions = async (
  prevState: BulkTransactionActionState,
  formData: FormData
): Promise<BulkTransactionResult | undefined> => {
  const failure = (message: string): BulkTransactionResult => ({
    success: false,
    message,
    saved: 0,
    skipped: 0,
    failed: 0,
    rows: [],
    savedTempIds: [],
  })

  const userId = await getSessionUserId()
  if (!userId) {
    return failure("Unauthorized: a valid session is required")
  }

  const accountIdRaw = formData.get("accountId")?.toString() || ""
  const transactionsJson = formData.get("transactionsJson")?.toString() || ""
  const rawCurrency = formData.get("transactionCurrency")?.toString().trim()

  if (!accountIdRaw || !/^\d+$/.test(accountIdRaw)) {
    return failure("Invalid bank account")
  }

  const accountId = Number(accountIdRaw)

  // Validar que la cuenta existe y pertenece al usuario
  const accountResult = await getBankAccountById({ id: accountId })
  if (!accountResult.ok) {
    return failure(accountResult.error?.message ?? "Bank account not found")
  }

  // Moneda por defecto del usuario: se guarda como snapshot en cada fila,
  // igual que en createTransaction/updateTransaction.
  const userResult = await getUserById(userId)
  const defaultCurrency = userResult.success
    ? (userResult.data?.defaultCurrency ?? "HNL")
    : "HNL"

  // La moneda la elige el usuario y aplica a todo el lote. Solo se cae a la
  // moneda del usuario si el campo no vino (cliente viejo); si vino pero es
  // inválida, se rechaza en lugar de guardar basura.
  let transactionCurrency: string
  if (!rawCurrency) {
    transactionCurrency = defaultCurrency
  } else {
    const parsedCurrency = transactionCurrencySchema.safeParse(rawCurrency)
    if (!parsedCurrency.success) {
      return failure("Please select a valid currency")
    }
    transactionCurrency = parsedCurrency.data
  }

  // La tasa es la misma para todas las filas: se resuelve una sola vez.
  let exchangeRate = 1
  if (transactionCurrency !== defaultCurrency) {
    try {
      exchangeRate = await getExchangeRate(transactionCurrency, defaultCurrency)
    } catch (error) {
      console.error("Error getting exchange rate:", error)
      return failure(
        error instanceof Error
          ? error.message
          : "Couldn't get the exchange rate"
      )
    }
  }

  // Resolver categoría por defecto una sola vez para todas las filas
  const defaultCategoryResult = await getDefaultCategory(userId)
  const defaultCategoryId = defaultCategoryResult.ok
    ? defaultCategoryResult.data
    : null

  // Parsear el JSON de transacciones
  let rawRows: unknown[]
  try {
    const parsed = JSON.parse(transactionsJson)
    if (!Array.isArray(parsed)) {
      throw new Error("transactionsJson must be an array")
    }
    rawRows = parsed
  } catch {
    return failure("Invalid transactions payload")
  }

  if (rawRows.length === 0) {
    return failure("No transactions to save")
  }

  // Validar cada fila de forma independiente
  const validRows: Array<{
    tempId: string
    row: number
    data: BulkTransactionInput
    /** Identidad congelada por el parser; `null` en filas sin snapshot. */
    dedupeHash: string | null
    dedupeOccurrence: number
  }> = []
  const rowResults: BulkTransactionRowResult[] = []

  for (const [index, value] of rawRows.entries()) {
    const fallbackRow = index + 1

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      rowResults.push({
        success: false,
        status: "failed",
        tempId: `row-${fallbackRow}`,
        row: fallbackRow,
        error: "Invalid row data",
      })
      continue
    }

    const raw = value as BulkTransactionRawInput
    const tempId =
      typeof raw.tempId === "string" && raw.tempId.length > 0
        ? raw.tempId
        : `row-${fallbackRow}`
    const rowNumber =
      typeof raw.row === "number" && Number.isFinite(raw.row)
        ? raw.row
        : fallbackRow

    // El accountId y el userId siempre se resuelven en el servidor.
    const validated = bulkTransactionSchema.safeParse({
      ...raw,
      accountId: accountIdRaw,
    })

    if (!validated.success) {
      const fieldErrors = z.treeifyError(validated.error)
      const messages = Object.entries(fieldErrors.properties ?? {}).flatMap(
        ([field, value]) =>
          (value?.errors ?? []).map((message) => `${field}: ${message}`)
      )

      rowResults.push({
        success: false,
        status: "failed",
        tempId,
        row: rowNumber,
        error: messages[0] ?? "Invalid row data",
      })
      continue
    }

    // categoryId es NOT NULL en la tabla: usar la elegida o la categoría por defecto.
    const categoryId = validated.data.categoryId ?? defaultCategoryId
    if (categoryId === null) {
      rowResults.push({
        success: false,
        status: "failed",
        tempId,
        row: rowNumber,
        error:
          "Category is required: select one or configure a default category",
      })
      continue
    }

    // El snapshot es dato de cliente: se canonicaliza antes de hashear. Si es
    // inválido, la fila falla; no se guarda sin hash en silencio.
    const rawDedupe = (value as { dedupe?: unknown }).dedupe
    let dedupeHash: string | null = null
    let dedupeOccurrence = 1

    if (rawDedupe !== undefined && rawDedupe !== null) {
      const snapshot = dedupeSnapshotSchema.safeParse(rawDedupe)

      if (!snapshot.success) {
        const originalErrors = z.treeifyError(snapshot.error).properties
          ?.original
        const detail = Object.values(originalErrors?.properties ?? {})
          .flatMap((value) => value?.errors ?? [])
          .at(0)

        rowResults.push({
          success: false,
          status: "failed",
          tempId,
          row: rowNumber,
          error: detail ?? "Invalid duplicate snapshot",
        })
        continue
      }

      dedupeHash = buildDedupeHash({
        accountId,
        currency: snapshot.data.original.currency ?? transactionCurrency,
        original: snapshot.data.original,
      })
      dedupeOccurrence = snapshot.data.occurrence
    }

    validRows.push({
      tempId,
      row: rowNumber,
      data: {
        ...validated.data,
        categoryId,
        userId,
      },
      dedupeHash,
      dedupeOccurrence,
    })
  }

  // Deduplicación: se clasifica antes de insertar para poder reportar
  // guardadas/omitidas con precisión. El índice único es solo el respaldo
  // contra la carrera entre la consulta y el insert.
  const omitDuplicates = formData.get("omitDuplicates")?.toString() !== "false"

  const hashes = validRows
    .map((row) => row.dedupeHash)
    .filter((hash): hash is string => hash !== null)

  const existingKeys = new Set<string>()
  const maxOccurrenceByHash = new Map<string, number>()

  if (hashes.length > 0) {
    const existingResult = await getDedupeKeysByHashes({ accountId, hashes })

    if (!existingResult.ok) {
      return failure(
        existingResult.error?.message ?? "Couldn't check for duplicate transactions"
      )
    }

    for (const key of existingResult.data) {
      existingKeys.add(`${key.dedupeHash}:${key.dedupeOccurrence}`)
      maxOccurrenceByHash.set(
        key.dedupeHash,
        Math.max(
          maxOccurrenceByHash.get(key.dedupeHash) ?? 0,
          key.dedupeOccurrence
        )
      )
    }
  }

  const rowsToInsert: typeof validRows = []
  const savedTempIds: string[] = []
  const pendingRows: typeof validRows = []
  const keptKeys = new Set<string>()
  let skipped = 0

  // Primera pasada: las filas cuya identidad está libre conservan la ocurrencia
  // que les asignó el parser (borrar/editar filas en el preview no renumera).
  for (const row of validRows) {
    if (row.dedupeHash === null) {
      rowsToInsert.push(row)
      continue
    }

    const key = `${row.dedupeHash}:${row.dedupeOccurrence}`
    if (existingKeys.has(key) || keptKeys.has(key)) {
      pendingRows.push(row)
      continue
    }

    keptKeys.add(key)
    maxOccurrenceByHash.set(
      row.dedupeHash,
      Math.max(maxOccurrenceByHash.get(row.dedupeHash) ?? 0, row.dedupeOccurrence)
    )
    rowsToInsert.push(row)
  }

  // Segunda pasada: lo que choca ya existe en la base. Con "omitir duplicados"
  // se descarta; sin el checkbox (el usuario afirma que es un movimiento real,
  // por ejemplo del mismo archivo exportado dos veces) se guarda con la
  // siguiente ocurrencia libre.
  for (const row of pendingRows) {
    if (omitDuplicates) {
      skipped += 1
      savedTempIds.push(row.tempId)
      rowResults.push({
        success: true,
        status: "duplicate",
        tempId: row.tempId,
        row: row.row,
      })
      continue
    }

    const hash = row.dedupeHash as string
    const occurrence = (maxOccurrenceByHash.get(hash) ?? 0) + 1
    maxOccurrenceByHash.set(hash, occurrence)
    rowsToInsert.push({ ...row, dedupeOccurrence: occurrence })
  }

  // Cada chunk es un único INSERT (atómico por sí mismo). Si un chunk falla,
  // los anteriores ya persistidos se mantienen y el cliente recibe
  // savedTempIds para quitarlos de la tabla y no reenviarlos.
  let saved = 0
  let failed = rowResults.filter((row) => row.status === "failed").length

  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE)
    const values = chunk.map((r) => ({
      userId: r.data.userId,
      accountId: r.data.accountId,
      amount: r.data.amount,
      transactionCurrency,
      exchangeRate: exchangeRate.toFixed(6),
      amountInDefaultCurrency: (Number(r.data.amount) * exchangeRate).toFixed(2),
      defaultCurrencyAtTransaction: defaultCurrency,
      transactionType: r.data.transactionType,
      transactionDescription: r.data.transactionDescription,
      transactionDate: r.data.transactionDate,
      categoryId: r.data.categoryId,
      bankReference: r.data.bankReference,
      dedupeHash: r.dedupeHash,
      dedupeOccurrence: r.dedupeOccurrence,
    }))

    try {
      // `onDuplicateKeyUpdate` con un no-op hace que el UNIQUE no rompa el
      // chunk; las filas que ya existían quedan intactas.
      //
      // No se usa `affectedRows` para contar: mysql2 habilita CLIENT_FOUND_ROWS
      // por defecto, así que un no-op también reporta 1. El conteo sale de la
      // clasificación previa; el UNIQUE solo garantiza que la carrera con otra
      // pestaña no cree filas repetidas (esa fila se reportaría como guardada,
      // pero la base queda consistente).
      await db
        .insert(transactions)
        .values(values)
        .onDuplicateKeyUpdate({ set: { id: sql`transaction_id` } })

      saved += chunk.length
      savedTempIds.push(...chunk.map((r) => r.tempId))
    } catch (error) {
      console.error("Error inserting bulk chunk:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Insert failed"
      for (const r of chunk) {
        rowResults.push({
          success: false,
          status: "failed",
          tempId: r.tempId,
          row: r.row,
          error: errorMessage,
        })
      }
      failed += chunk.length
    }
  }

  revalidatePath("/transactions")
  revalidatePath("/")

  return {
    success: failed === 0,
    message: buildBulkMessage(saved, skipped, failed),
    saved,
    skipped,
    failed,
    rows: rowResults,
    savedTempIds,
  }
}

const duplicatePreviewRowSchema = z.object({
  tempId: z.string().min(1),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z
    .string()
    .trim()
    .refine((value) => canonicalAmount(value) !== null),
  transactionType: z.enum(["income", "expense"]),
  bankReference: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value || null),
  dedupe: dedupeSnapshotSchema.optional(),
})

/**
 * `true` solo si ambas referencias existen y son distintas: si a alguna le
 * falta, no hay forma de descartar el parecido (caso CSV vs PDF).
 */
const hasConflictingReferences = (
  left: string | null,
  right: string | null
): boolean => {
  const a = normalizeForHash(left)
  const b = normalizeForHash(right)

  return a.length > 0 && b.length > 0 && a !== b
}

interface PreviewCandidate {
  tempId: string
  hash: string | null
  occurrence: number | null
  date: string
  amount: string
  type: "income" | "expense"
  reference: string | null
}

/**
 * Chequea, antes de guardar, qué filas del archivo ya están importadas.
 *
 * - `exact`: hay una fila con el mismo hash y ocurrencia. Se apoya en el
 *   snapshot, así que editar fecha/monto en el preview no invalida el
 *   resultado (la identidad no cambia).
 * - `possible`: misma cuenta, fecha, monto, tipo y moneda, pero sin
 *   referencias que confirmen o descarten el parecido. Solo se advierte.
 */
export const previewTransactionDuplicates = async (payload: {
  accountId: number
  currency: string
  rows: unknown[]
}): Promise<DuplicatePreviewResult> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      duplicates: {},
      exactCount: 0,
      possibleCount: 0,
    }
  }

  const accountId = Number(payload.accountId)
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return {
      success: false,
      message: "Invalid bank account",
      duplicates: {},
      exactCount: 0,
      possibleCount: 0,
    }
  }

  const accountResult = await getBankAccountById({ id: accountId })
  if (!accountResult.ok) {
    return {
      success: false,
      message: accountResult.error?.message ?? "Bank account not found",
      duplicates: {},
      exactCount: 0,
      possibleCount: 0,
    }
  }

  const parsedCurrency = transactionCurrencySchema.safeParse(payload.currency)
  if (!parsedCurrency.success) {
    return {
      success: false,
      message: "Please select a valid currency",
      duplicates: {},
      exactCount: 0,
      possibleCount: 0,
    }
  }

  const currency = parsedCurrency.data
  const rows = Array.isArray(payload.rows) ? payload.rows : []

  const candidates: PreviewCandidate[] = []
  const seenTempIds = new Set<string>()

  for (const value of rows) {
    const parsed = duplicatePreviewRowSchema.safeParse(value)
    if (!parsed.success) continue

    const raw = parsed.data
    if (seenTempIds.has(raw.tempId)) continue
    seenTempIds.add(raw.tempId)

    const amount = canonicalAmount(raw.amount)
    if (amount === null) continue

    const snapshot = raw.dedupe ?? null

    candidates.push({
      tempId: raw.tempId,
      hash: snapshot
        ? buildDedupeHash({
            accountId,
            currency: snapshot.original.currency ?? currency,
            original: snapshot.original,
          })
        : null,
      occurrence: snapshot?.occurrence ?? null,
      date: raw.transactionDate,
      amount,
      type: raw.transactionType,
      reference: raw.bankReference,
    })
  }

  const duplicates: Record<string, DuplicatePreviewEntry> = {}

  const hashes = candidates
    .map((candidate) => candidate.hash)
    .filter((hash): hash is string => hash !== null)

  if (hashes.length > 0) {
    const existingResult = await getDedupeKeysByHashes({ accountId, hashes })

    if (!existingResult.ok) {
      return {
        success: false,
        message: existingResult.error?.message,
        duplicates: {},
        exactCount: 0,
        possibleCount: 0,
      }
    }

    const existingKeys = new Set(
      existingResult.data.map((key) => `${key.dedupeHash}:${key.dedupeOccurrence}`)
    )

    for (const candidate of candidates) {
      if (
        candidate.hash &&
        candidate.occurrence !== null &&
        existingKeys.has(`${candidate.hash}:${candidate.occurrence}`)
      ) {
        duplicates[candidate.tempId] = { exact: true, possible: false }
      }
    }
  }

  const remaining = candidates.filter(
    (candidate) => !duplicates[candidate.tempId]
  )

  if (remaining.length > 0) {
    const dates = remaining.map((candidate) => candidate.date).sort()
    const range = await getTransactionsInDateRange({
      accountId,
      from: dates[0],
      to: dates[dates.length - 1],
    })

    if (!range.ok) {
      return {
        success: false,
        message: range.error?.message,
        duplicates: {},
        exactCount: 0,
        possibleCount: 0,
      }
    }

    for (const candidate of remaining) {
      const matches = range.data.some(
        (existing) =>
          existing.transactionDate === candidate.date &&
          canonicalAmount(existing.amount) === candidate.amount &&
          existing.transactionType === candidate.type &&
          existing.transactionCurrency === currency &&
          !hasConflictingReferences(candidate.reference, existing.bankReference)
      )

      if (matches) {
        duplicates[candidate.tempId] = { exact: false, possible: true }
      }
    }
  }

  let exactCount = 0
  let possibleCount = 0

  for (const entry of Object.values(duplicates)) {
    if (entry.exact) exactCount += 1
    else if (entry.possible) possibleCount += 1
  }

  return {
    success: true,
    duplicates,
    exactCount,
    possibleCount,
  }
}
