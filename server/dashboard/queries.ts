import { db } from "@/db"
import { bankAccounts, categories, transactions } from "@/db/schema/schema"
import { err, ok, type Result } from "@/types/result"
import type {
  CategoryExpense,
  DailyAverage,
  FundShare,
  MonthlyFinancial,
} from "@/types/dashboard.types"
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm"

export async function getMonthlyFinancials(
  userId: number
): Promise<Result<MonthlyFinancial[]>> {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const rows = await db
      .select({
        monthNumber: sql<number>`MONTH(${transactions.createdAt})`,
        month: sql<string>`MONTHNAME(${transactions.createdAt})`,
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.createdAt, sixMonthsAgo)
        )
      )
      .groupBy(
        sql`MONTH(${transactions.createdAt})`,
        sql`MONTHNAME(${transactions.createdAt})`
      )
      .orderBy(sql`MONTH(${transactions.createdAt})`)

    return ok(
      rows.map((row) => ({
        ...row,
        income: Number(row.income),
        expense: Number(row.expense),
      }))
    )
  } catch (error) {
    console.error("Error en getMonthlyFinancials (posible BD dormida):", error)
    return err("database", "Couldn't get monthly financials try it later")
  }
}

export const getDailyAverage = async (
  userId: number
): Promise<Result<DailyAverage>> => {
  try {
    const monthFirstDay = sql<string>`DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
    const currentDay = new Date().getDate()
    const [result] = await db
      .select({
        totalExpenses: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.transactionType, "expense"),
          gte(transactions.createdAt, monthFirstDay)
        )
      )
    const total = result?.totalExpenses || 0
    const dailyAverage = total / currentDay

    return ok({
      monthTotal: total,
      dailyAverage,
      currentDay,
    })
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the daily average try it later")
  }
}

export const getNetBalance = async (
  userId: number
): Promise<Result<number>> => {
  try {
    const [accountsResult, transactionsResult] = await Promise.all([
      db
        .select({
          openingSum: sql<
            string | number
          >`COALESCE(SUM(${bankAccounts.openingBalance}), 0)`,
        })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId)),
      db
        .select({
          netTransactions: sql<string | number>`
          COALESCE(
            SUM(
              CASE 
                WHEN ${transactions.transactionType} = 'income' THEN ${transactions.amount}
                WHEN ${transactions.transactionType} = 'expense' THEN -${transactions.amount}
                ELSE 0 
              END
            ), 0
          )
        `,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId)),
    ])

    // 2. Extraemos los primeros resultados de los arrays devueltos
    const openingSumRaw = accountsResult[0]?.openingSum ?? 0
    const transactionsSumRaw = transactionsResult[0]?.netTransactions ?? 0

    // 3. Parseamos de forma segura los valores (MySQL suele retornar strings para SUM)
    const openingSum =
      typeof openingSumRaw === "string"
        ? parseFloat(openingSumRaw)
        : openingSumRaw
    const transactionsSum =
      typeof transactionsSumRaw === "string"
        ? parseFloat(transactionsSumRaw)
        : transactionsSumRaw

    // 4. La matemática final viva
    return ok(openingSum + transactionsSum)
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the net balance try it later")
  }
}

export const getFundsDistribution = async (
  userId: number
): Promise<Result<FundShare[]>> => {
  try {
    const rows = await db
      .select({
        bankName: bankAccounts.bankName,
        accountType: bankAccounts.bankAccountType,
        openingBalance: bankAccounts.openingBalance,
        netTransactions: sql<number>`COALESCE(SUM(
    CASE
     WHEN ${transactions.transactionType} = 'income' THEN ${transactions.amount}
     WHEN ${transactions.transactionType} = 'expense' THEN -${transactions.amount}
     ELSE 0
      END), 0)`,
      })
      .from(bankAccounts)
      .leftJoin(transactions, eq(bankAccounts.id, transactions.accountId))
      .where(eq(bankAccounts.userId, userId))
      .groupBy(
        bankAccounts.id,
        bankAccounts.bankName,
        bankAccounts.bankAccountType
      )

    const distribution: FundShare[] = rows.map((row) => {
      const currentBalance =
        Number(row.openingBalance) + Number(row.netTransactions)
      return {
        name: row.bankName ?? "Unknown",
        type: row.accountType,
        value: currentBalance < 0 ? 0 : Number(currentBalance.toFixed(2)),
      }
    })
    return ok(distribution) /* .filter((account) => account.value > 0) */
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the funds distribution try it later")
  }
}

export const getExpensesByCategories = async (
  userId: number
): Promise<Result<CategoryExpense[]>> => {
  const currentYear = new Date().getFullYear()
  const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`)
  const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`)
  try {
    const result = await db
      .select({
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        total_amount: sql<number>`CAST(COALESCE(SUM(${transactions.amount}), 0) AS DECIMAL(10,2))`,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.categoryId, transactions.categoryId))

      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.transactionType, "expense"),
          gte(transactions.createdAt, startOfYear),
          lte(transactions.createdAt, endOfYear),
          or(eq(categories.userId, userId), isNull(categories.userId))
        )
      )
      .groupBy(categories.name, categories.color, categories.icon)

    return ok(result)
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the expenses try it later")
  }
}