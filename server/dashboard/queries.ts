import { db } from "@/db"
import { bankAccounts, categories, transactions } from "@/db/schema/schema"
import { err, ok, type Result } from "@/types/result"
import type {
  CategoryExpense,
  DailyAverage,
  FundShare,
  MonthlyFinancial,
} from "@/types/dashboard.types"
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm"
import { getExchangeRates } from "@/lib/currency"
import { getUserDefaultCurrency } from "@/server/users/queries"

/**
 * Convierte un monto de una moneda origen a una moneda destino.
 * Si son iguales, retorna el monto sin cambios.
 * Obtiene la tasa de conversión desde Frankfurter API (con caché).
 */
async function convertAmount(
  amount: number | string,
  fromCurrency: string,
  toCurrency: string,
  ratesCache: Record<string, Record<string, number>>
): Promise<number> {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (fromCurrency === toCurrency) return num

  if (!ratesCache[fromCurrency]) {
    ratesCache[fromCurrency] = await getExchangeRates(fromCurrency, [toCurrency])
  }
  const rate = ratesCache[fromCurrency][toCurrency]
  return num * rate
}

/**
 * Obtiene todas las transacciones de un usuario con sus campos de moneda,
 * listas para ser convertidas a la moneda por defecto actual.
 */
async function getTransactionsWithCurrency(userId: number) {
  return await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      transactionCurrency: transactions.transactionCurrency,
      amountInDefaultCurrency: transactions.amountInDefaultCurrency,
      defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
      transactionType: transactions.transactionType,
      transactionDate: transactions.transactionDate,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.transactionDate))
}

export async function getMonthlyFinancials(
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<MonthlyFinancial[]>> {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const rows = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        transactionType: transactions.transactionType,
        transactionDate: transactions.transactionDate,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.transactionDate, sixMonthsAgo)
        )
      )
      .orderBy(transactions.transactionDate)

    const ratesCache: Record<string, Record<string, number>> = {}

    const monthlyMap = new Map<
      string,
      { monthNumber: number; month: string; income: number; expense: number }
    >()

    for (const row of rows) {
      // mysql2 devuelve las columnas DATE como objetos Date a medianoche UTC.
      // Usar los getters UTC evita el corrimiento de día por la zona horaria local.
      const rawDate: Date | string = row.transactionDate
      const date = rawDate instanceof Date ? rawDate : new Date(rawDate)
      const year = date.getUTCFullYear()
      const monthNumber = date.getUTCMonth() + 1
      const month = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString(
        "en-US",
        { month: "long", timeZone: "UTC" }
      )
      const key = `${year}-${String(monthNumber).padStart(2, "0")}`

      const convertedAmount = await convertAmount(
        row.amountInDefaultCurrency,
        row.defaultCurrencyAtTransaction,
        defaultCurrency,
        ratesCache
      )

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { monthNumber, month, income: 0, expense: 0 })
      }
      const entry = monthlyMap.get(key)!
      if (row.transactionType === "income") {
        entry.income += convertedAmount
      } else {
        entry.expense += convertedAmount
      }
    }

    const result = Array.from(monthlyMap.values())
      .map((entry) => ({
        ...entry,
        income: Number(entry.income.toFixed(2)),
        expense: Number(entry.expense.toFixed(2)),
      }))
      .sort((a, b) => a.monthNumber - b.monthNumber)

    return ok(result)
  } catch (error) {
    console.error("Error en getMonthlyFinancials:", error)
    return err("database", "Couldn't get monthly financials try it later")
  }
}

export const getDailyAverage = async (
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<DailyAverage>> => {
  try {
    const monthFirstDay = sql<string>`DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')`
    const currentDay = new Date().getDate()

    const rows = await db
      .select({
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.transactionType, "expense"),
          gte(transactions.transactionDate, monthFirstDay)
        )
      )

    const ratesCache: Record<string, Record<string, number>> = {}

    let total = 0
    for (const row of rows) {
      const converted = await convertAmount(
        row.amountInDefaultCurrency,
        row.defaultCurrencyAtTransaction,
        defaultCurrency,
        ratesCache
      )
      total += converted
    }

    const dailyAverage = total / currentDay

    return ok({
      monthTotal: Number(total.toFixed(2)),
      dailyAverage: Number(dailyAverage.toFixed(2)),
      currentDay,
    })
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the daily average try it later")
  }
}

export const getNetBalance = async (
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<number>> => {
  try {
    const [accountsResult, transactionsResult] = await Promise.all([
      db
        .select({
          openingBalance: bankAccounts.openingBalance,
          accountCurrency: bankAccounts.accountCurrency,
          id: bankAccounts.id,
        })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId)),
      getTransactionsWithCurrency(userId),
    ])

    const ratesCache: Record<string, Record<string, number>> = {}

    // Sumar opening balances convertidos a la moneda por defecto del usuario
    let openingSum = 0
    for (const account of accountsResult) {
      const converted = await convertAmount(
        account.openingBalance,
        account.accountCurrency ?? defaultCurrency,
        defaultCurrency,
        ratesCache
      )
      openingSum += converted
    }

    // Sumar transacciones netas convertidas a la moneda por defecto del usuario
    let transactionsSum = 0
    for (const tx of transactionsResult) {
      const converted = await convertAmount(
        tx.amountInDefaultCurrency,
        tx.defaultCurrencyAtTransaction,
        defaultCurrency,
        ratesCache
      )
      if (tx.transactionType === "income") {
        transactionsSum += converted
      } else {
        transactionsSum -= converted
      }
    }

    return ok(Number((openingSum + transactionsSum).toFixed(2)))
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the net balance try it later")
  }
}

export const getFundsDistribution = async (
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<FundShare[]>> => {
  try {
    const accounts = await db
      .select({
        id: bankAccounts.id,
        bankName: bankAccounts.bankName,
        accountType: bankAccounts.bankAccountType,
        openingBalance: bankAccounts.openingBalance,
        accountCurrency: bankAccounts.accountCurrency,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))

    const transactionsByAccount = await getTransactionsWithCurrency(userId)

    const ratesCache: Record<string, Record<string, number>> = {}

    const distribution: FundShare[] = []

    for (const account of accounts) {
      const accountTxs = transactionsByAccount.filter(
        (tx) => tx.accountId === account.id
      )

      // Opening balance convertido a la moneda por defecto del usuario
      const convertedOpening = await convertAmount(
        account.openingBalance,
        account.accountCurrency ?? defaultCurrency,
        defaultCurrency,
        ratesCache
      )

      // Transacciones netas de esta cuenta convertidas
      let netTransactions = 0
      for (const tx of accountTxs) {
        const converted = await convertAmount(
          tx.amountInDefaultCurrency,
          tx.defaultCurrencyAtTransaction,
          defaultCurrency,
          ratesCache
        )
        if (tx.transactionType === "income") {
          netTransactions += converted
        } else {
          netTransactions -= converted
        }
      }

      const currentBalance = convertedOpening + netTransactions
      distribution.push({
        name: account.bankName ?? "Unknown",
        type: account.accountType,
        value: currentBalance < 0 ? 0 : Number(currentBalance.toFixed(2)),
      })
    }

    return ok(distribution)
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the funds distribution try it later")
  }
}

export const getExpensesByCategories = async (
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<CategoryExpense[]>> => {
  const currentYear = new Date().getFullYear()
  const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`)
  const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`)

  try {
    const rows = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        transactionCurrency: transactions.transactionCurrency,
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.categoryId, transactions.categoryId))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.transactionType, "expense"),
          gte(transactions.transactionDate, startOfYear),
          lte(transactions.transactionDate, endOfYear),
          or(eq(categories.userId, userId), isNull(categories.userId))
        )
      )

    const ratesCache: Record<string, Record<string, number>> = {}

    const categoryMap = new Map<
      string,
      { categoryName: string; categoryColor: string | null; categoryIcon: string | null; total: number }
    >()

    for (const row of rows) {
      const converted = await convertAmount(
        row.amountInDefaultCurrency,
        row.defaultCurrencyAtTransaction,
        defaultCurrency,
        ratesCache
      )

      const key = String(row.categoryId)
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          categoryName: row.categoryName ?? "Unknown",
          categoryColor: row.categoryColor,
          categoryIcon: row.categoryIcon,
          total: 0,
        })
      }
      const entry = categoryMap.get(key)!
      entry.total += converted
    }

    const result = Array.from(categoryMap.values()).map((entry) => ({
      categoryName: entry.categoryName,
      categoryColor: entry.categoryColor,
      categoryIcon: entry.categoryIcon,
      total_amount: Number(entry.total.toFixed(2)),
    }))

    return ok(result)
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the expenses try it later")
  }
}
