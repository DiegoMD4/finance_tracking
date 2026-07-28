import { db } from "@/db"
import { bankAccounts, categories, transactions } from "@/db/schema/schema"
import { GetTransactionById, GetTransactions } from "@/types/transactions.types"
import { desc, eq } from "drizzle-orm"

export const getTransactions = async (): Promise<GetTransactions> => {
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
      .orderBy(desc(transactions.createdAt))

    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: [],
      error: "Couldn't get any transactions try it later",
    }
  }
}
export const getTransactionsById = async ({
  id,
}: {
  id: number
}): Promise<GetTransactionById> => {
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
      .where(eq(transactions.id, id))
      .limit(1)
    
    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: undefined,
      error: "Couldn't get your transaction try it later",
    }
  }
}

export const getTransactionsPaginated = async (
  page = 1,
  pageSize = 10
): Promise<GetTransactions> => {
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
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize)
    const hasMore = res.length > pageSize
    const dataToReturn = hasMore ? res.slice(0, pageSize) : res
    return {
      success: true,
      data: dataToReturn,
      hasMore,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: [],
      error: "Couldn't get any transactions try it later",
    }
  }
}
