import { db } from "@/db"
import { bankAccounts, transactions } from "@/db/schema/schema"
import { and, eq, gte, sql } from "drizzle-orm"

export async function getMonthlyFinancials(userId: number) {
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

  return rows.map((row) => ({
    ...row,
    income: Number(row.income),
    expense: Number(row.expense),
  }))
}

export const getDailyAverage = async (userId: number) => {
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

  return {
    monthTotal: total,
    dailyAverage,
    currentDay,
  }
}

export const getNetBalance = async (userId: number): Promise<number> => {
  // 1. Ejecutamos ambas sumas en paralelo para máxima velocidad
  const [accountsResult, transactionsResult] = await Promise.all([
    // Consulta A: Suma de los balances de apertura iniciales
    db
      .select({
        openingSum: sql<
          string | number
        >`COALESCE(SUM(${bankAccounts.openingBalance}), 0)`,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId)),

    // Consulta B: Suma condicional de transacciones (Ingresos vs Gastos)
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
  return openingSum + transactionsSum
}

export const getFundsDistribution = async (userId: number) => {
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

  const distribution = rows.map((row) => {
    const currentBalance =
      Number(row.openingBalance) + Number(row.netTransactions)
    return {
      name: row.bankName,
      type: row.accountType,
      value: currentBalance < 0 ? 0 : Number(currentBalance.toFixed(2)),
    }
  })
  return distribution/* .filter((account) => account.value > 0) */
}
