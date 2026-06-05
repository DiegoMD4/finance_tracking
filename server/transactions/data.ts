import { db } from "@/db"
import { bankAccounts, transactions } from "@/db/schema/schema"
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
        source: transactions.source,
        createdAt: transactions.createdAt,
        accountName: bankAccounts.accountName,
        bankName: bankAccounts.bankName,
      })
      .from(transactions)
      .leftJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
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
    const res = await db.query.transactions.findFirst({
      where: (transactions, { eq: equals }) => equals(transactions.id, id),
    })

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
