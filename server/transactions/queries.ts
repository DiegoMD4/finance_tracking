import { db } from "@/db"
import { bankAccounts, categories, transactions } from "@/db/schema/schema"
import { err, ok, type Paginated, type Result } from "@/types/result"
import { and, desc, eq } from "drizzle-orm"
import { getSessionUserId } from "@/lib/jwt"
import type {
  Transaction,
  TransactionListItem,
} from "@/types/transactions.types"

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
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
        accountName: bankAccounts.accountName,
        bankName: bankAccounts.bankName,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))

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
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
        accountName: bankAccounts.accountName,
        bankName: bankAccounts.bankName,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
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
        transactionType: transactions.transactionType,
        transactionDescription: transactions.transactionDescription,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,

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