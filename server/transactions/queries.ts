import { db } from "@/db"
import {
  bankAccounts,
  categories,
  importBatches,
  transactions,
} from "@/db/schema/schema"
import { err, ok, type Paginated, type Result } from "@/types/result"
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { getSessionUserId } from "@/lib/jwt"
import type {
  ImportBatchSummary,
  Transaction,
  TransactionListItem,
} from "@/types/transactions.types"
import type { TransactionType } from "@/types/transactions.types"

export const getTransactions = async (): Promise<
  Result<TransactionListItem[]>
> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        exchangeRate: transactions.exchangeRate,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
        accountName: bankAccounts.accountName,
        bankName: bankAccounts.bankName,
        categoryName: categories.name,
        transactionDate: sql<string>`DATE_FORMAT(${transactions.transactionDate}, '%d-%m-%Y')`,
      })
      .from(transactions)
      .leftJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate))

    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get any transactions try it later")
  }
}

export const getTransactionsPaginated = async (
  page = 1,
  pageSize = 10
): Promise<Result<Paginated<TransactionListItem>>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        exchangeRate: transactions.exchangeRate,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
        accountName: bankAccounts.accountName,
        bankName: bankAccounts.bankName,
        categoryName: categories.name,
        transactionDate: sql<string>`DATE_FORMAT(${transactions.transactionDate}, '%d-%m-%Y')`,
      })
      .from(transactions)
      .leftJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize)

    const hasMore = res.length > pageSize
    const items = hasMore ? res.slice(0, pageSize) : res

    return ok({ items, hasMore })
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get any transactions try it later")
  }
}

export const getTransactionsById = async ({
  id,
}: {
  id: number
}): Promise<Result<Transaction>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const [res] = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        exchangeRate: transactions.exchangeRate,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
        transactionDate: sql<string>`DATE_FORMAT(${transactions.transactionDate}, '%d-%m-%Y')`,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1)

    if (!res) {
      return err("not_found", "Transaction not found")
    }

    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get your transaction try it later")
  }
}

/** Clave de identidad ya usada por una fila importada. */
export interface DedupeKey {
  dedupeHash: string
  dedupeOccurrence: number
}

const HASH_LOOKUP_CHUNK = 500

/**
 * Busca las identidades ya importadas de una cuenta.
 *
 * Se consulta **solo por hash**, sin rango de fechas: el hash guarda la fecha
 * del snapshot y la fila guarda la fecha (posiblemente editada). Filtrar por
 * fecha dejaría afuera justo el caso que el snapshot resuelve.
 * El índice único `(account_id, dedupe_hash, dedupe_occurrence)` la cubre.
 */
export const getDedupeKeysByHashes = async ({
  accountId,
  hashes,
}: {
  accountId: number
  hashes: string[]
}): Promise<Result<DedupeKey[]>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  const uniqueHashes = [...new Set(hashes.filter((hash) => hash.length > 0))]
  if (uniqueHashes.length === 0) return ok([])

  try {
    const found: DedupeKey[] = []

    for (let i = 0; i < uniqueHashes.length; i += HASH_LOOKUP_CHUNK) {
      const chunk = uniqueHashes.slice(i, i + HASH_LOOKUP_CHUNK)
      const rows = await db
        .select({
          dedupeHash: transactions.dedupeHash,
          dedupeOccurrence: transactions.dedupeOccurrence,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.userId, userId),
            inArray(transactions.dedupeHash, chunk)
          )
        )

      for (const row of rows) {
        if (!row.dedupeHash) continue
        found.push({
          dedupeHash: row.dedupeHash,
          dedupeOccurrence: row.dedupeOccurrence,
        })
      }
    }

    return ok(found)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't check for duplicate transactions")
  }
}

/** Fila existente que puede confundirse con una importación (duplicado "posible"). */
export interface DedupeComparisonRow {
  amount: string
  transactionType: TransactionType
  /** YYYY-MM-DD */
  transactionDate: string
  transactionCurrency: string
  bankReference: string | null
}

/**
 * Filas de una cuenta dentro de un rango de fechas. Se usa solo para el aviso
 * de duplicado "posible", que compara contra lo que el usuario ve (fecha,
 * monto y tipo finales), no contra el hash.
 */
export const getTransactionsInDateRange = async ({
  accountId,
  from,
  to,
}: {
  accountId: number
  /** YYYY-MM-DD inclusive. */
  from: string
  /** YYYY-MM-DD inclusive. */
  to: string
}): Promise<Result<DedupeComparisonRow[]>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const rows = await db
      .select({
        amount: transactions.amount,
        transactionType: transactions.transactionType,
        transactionDate: sql<string>`DATE_FORMAT(${transactions.transactionDate}, '%Y-%m-%d')`,
        transactionCurrency: transactions.transactionCurrency,
        bankReference: transactions.bankReference,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.userId, userId),
          sql`${transactions.transactionDate} BETWEEN ${from} AND ${to}`
        )
      )

    return ok(rows)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't check for duplicate transactions")
  }
}

/** Columnas del resumen de lote; mismo shape en las dos consultas. */
const importBatchColumns = {
  id: importBatches.id,
  accountId: importBatches.accountId,
  accountName: bankAccounts.accountName,
  fileName: importBatches.fileName,
  fileHash: importBatches.fileHash,
  fileSize: importBatches.fileSize,
  sourceFormat: importBatches.sourceFormat,
  rowCount: importBatches.rowCount,
  savedCount: importBatches.savedCount,
  skippedCount: importBatches.skippedCount,
  failedCount: importBatches.failedCount,
  createdAt: importBatches.createdAt,
  undoneAt: importBatches.undoneAt,
}

/**
 * Busca si ese archivo ya se importó en esa cuenta.
 *
 * Solo considera lotes que hayan guardado algo (`saved_count > 0`): un lote
 * huérfano (el proceso murió antes de actualizar los conteos) no debe disparar
 * el aviso. Devuelve el más reciente.
 */
export const getImportBatchStatus = async ({
  accountId,
  fileHash,
}: {
  accountId: number
  /** SHA-256 hex del archivo. */
  fileHash: string
}): Promise<Result<ImportBatchSummary | null>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const [batch] = await db
      .select(importBatchColumns)
      .from(importBatches)
      .leftJoin(bankAccounts, eq(importBatches.accountId, bankAccounts.id))
      .where(
        and(
          eq(importBatches.userId, userId),
          eq(importBatches.accountId, accountId),
          eq(importBatches.fileHash, fileHash),
          isNull(importBatches.deletedAt),
          gt(importBatches.savedCount, 0)
        )
      )
      .orderBy(desc(importBatches.createdAt))
      .limit(1)

    return ok(batch ?? null)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't check previous imports")
  }
}

/** Historial de importaciones del usuario, más recientes primero. */
export const getRecentImportBatches = async (
  limit = 20
): Promise<Result<ImportBatchSummary[]>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const rows = await db
      .select(importBatchColumns)
      .from(importBatches)
      .leftJoin(bankAccounts, eq(importBatches.accountId, bankAccounts.id))
      .where(
        and(eq(importBatches.userId, userId), isNull(importBatches.deletedAt))
      )
      .orderBy(desc(importBatches.createdAt))
      .limit(limit)

    return ok(rows)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get the import history")
  }
}
