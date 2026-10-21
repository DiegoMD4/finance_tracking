"use server"

import {
  transactionSchema,
  transactionCurrencySchema,
  bulkTransactionSchema,
} from "@/app/(app)/transactions/schema"
import { db } from "@/db"
import { transactions } from "@/db/schema/schema"
import { getDefaultCategory } from "@/server/categories/queries"
import { getBankAccountById } from "@/server/bank-accounts/queries"
import { getUserById } from "@/server/users/queries"
import {
  TransactionsActionState,
  CreateTransaction,
  UpdateTransaction,
  BulkTransactionResult,
  BulkTransactionActionState,
  BulkTransactionInput,
  BulkTransactionRawInput,
  BulkTransactionRowResult,
} from "@/types/transactions.types"

import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"
import { getSessionUserId } from "@/lib/jwt"
import { getExchangeRate } from "@/lib/currency"

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
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
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
    transactionCurrency,
  } = validatedFields.data

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

export const createBulkTransactions = async (
  prevState: BulkTransactionActionState,
  formData: FormData
): Promise<BulkTransactionResult | undefined> => {
  const failure = (message: string): BulkTransactionResult => ({
    success: false,
    message,
    saved: 0,
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
  }> = []
  const rowResults: BulkTransactionRowResult[] = []

  for (const [index, value] of rawRows.entries()) {
    const fallbackRow = index + 1

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      rowResults.push({
        success: false,
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
        tempId,
        row: rowNumber,
        error:
          "Category is required: select one or configure a default category",
      })
      continue
    }

    validRows.push({
      tempId,
      row: rowNumber,
      data: {
        ...validated.data,
        categoryId,
        userId,
      },
    })
  }

  // Cada chunk es un único INSERT (atómico por sí mismo). Si un chunk falla,
  // los anteriores ya persistidos se mantienen y el cliente recibe
  // savedTempIds para quitarlos de la tabla y no reenviarlos.
  let saved = 0
  let failed = rowResults.length
  const savedTempIds: string[] = []

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE)
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
    }))

    try {
      await db.insert(transactions).values(values)
      saved += chunk.length
      savedTempIds.push(...chunk.map((r) => r.tempId))
    } catch (error) {
      console.error("Error inserting bulk chunk:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Insert failed"
      for (const r of chunk) {
        rowResults.push({
          success: false,
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
    message:
      failed === 0
        ? `Saved ${saved} transaction${saved !== 1 ? "s" : ""} successfully`
        : `Saved ${saved} transaction${saved !== 1 ? "s" : ""}, ${failed} failed`,
    saved,
    failed,
    rows: rowResults,
    savedTempIds,
  }
}
