import { db } from "@/db"
import { bankAccounts, categories, transactions } from "@/db/schema/schema"
import { err, ok, type Result } from "@/types/result"
import type {
  CategoryExpense,
  FundShare,
  MonthlyFinancial,
  MonthlyPace,
} from "@/types/dashboard.types"
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm"
import { getExchangeRates } from "@/lib/currency"
import { getDaysInMonth } from "@/lib/dashboard/metrics"

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
    ratesCache[fromCurrency] = await getExchangeRates(fromCurrency, [
      toCurrency,
    ])
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
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.transactionDate, sixMonthsAgo),
          isNull(bankAccounts.deletedAt)
        )
      )
      .orderBy(transactions.transactionDate)

    const ratesCache: Record<string, Record<string, number>> = {}

    const monthlyMap = new Map<
      string,
      {
        year: number
        monthNumber: number
        month: string
        income: number
        expense: number
      }
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
        monthlyMap.set(key, { year, monthNumber, month, income: 0, expense: 0 })
      }
      const entry = monthlyMap.get(key)!
      if (row.transactionType === "income") {
        entry.income += convertedAmount
      } else {
        entry.expense += convertedAmount
      }
    }

    // Ordenar por la clave `YYYY-MM` y no por `monthNumber`: con una ventana de
    // 6 meses que cruza el año, ordenar por número de mes dejaría enero y
    // febrero antes de septiembre-diciembre.
    const result = Array.from(monthlyMap.entries())
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([, entry]) => ({
        ...entry,
        income: Number(entry.income.toFixed(2)),
        expense: Number(entry.expense.toFixed(2)),
      }))

    return ok(result)
  } catch (error) {
    console.error("Error en getMonthlyFinancials:", error)
    return err("database", "Couldn't get monthly financials try it later")
  }
}

/**
 * Totales del mes en curso (MTD) y del mes anterior.
 *
 * Las fechas se calculan en JS para que el rango consultado, el día actual y el
 * tope del mes anterior salgan de la misma fuente. Antes `getDailyAverage`
 * filtraba con `NOW()` de MySQL y contaba los días con `new Date()` de Node,
 * lo que podía desalinearse cerca del cambio de mes.
 */
export const getMonthlyPace = async (
  userId: number,
  defaultCurrency: string = "HNL"
): Promise<Result<MonthlyPace>> => {
  try {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()

    const daysInMonth = getDaysInMonth(currentYear, currentMonth)

    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1)
    const previousYear = previousMonthDate.getFullYear()
    const previousMonth = previousMonthDate.getMonth()
    const daysInPreviousMonth = getDaysInMonth(previousYear, previousMonth)
    // Si hoy es 31 y el mes anterior tiene 30 días, se compara contra el mes
    // anterior completo en lugar de dejar días sin cubrir.
    const samePeriodDay = Math.min(currentDay, daysInPreviousMonth)

    const previousMonthStart = new Date(previousYear, previousMonth, 1)
    const currentMonthEnd = new Date(currentYear, currentMonth, daysInMonth)

    const rows = await db
      .select({
        amountInDefaultCurrency: transactions.amountInDefaultCurrency,
        defaultCurrencyAtTransaction: transactions.defaultCurrencyAtTransaction,
        transactionType: transactions.transactionType,
        transactionDate: transactions.transactionDate,
      })
      .from(transactions)
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(bankAccounts.deletedAt),
          gte(transactions.transactionDate, previousMonthStart),
          lte(transactions.transactionDate, currentMonthEnd)
        )
      )

    const ratesCache: Record<string, Record<string, number>> = {}

    let currentIncome = 0
    let currentExpense = 0
    let previousSameIncome = 0
    let previousSameExpense = 0
    let previousFullIncome = 0
    let previousFullExpense = 0

    for (const row of rows) {
      // mysql2 devuelve las columnas DATE como objetos Date a medianoche UTC.
      // Usar los getters UTC evita el corrimiento de día por la zona horaria local.
      const rawDate: Date | string = row.transactionDate
      const date = rawDate instanceof Date ? rawDate : new Date(rawDate)
      const rowYear = date.getUTCFullYear()
      const rowMonth = date.getUTCMonth()
      const rowDay = date.getUTCDate()

      const isCurrentMonth =
        rowYear === currentYear && rowMonth === currentMonth
      const isPreviousMonth =
        rowYear === previousYear && rowMonth === previousMonth

      if (!isCurrentMonth && !isPreviousMonth) continue

      const converted = await convertAmount(
        row.amountInDefaultCurrency,
        row.defaultCurrencyAtTransaction,
        defaultCurrency,
        ratesCache
      )

      const isIncome = row.transactionType === "income"

      if (isCurrentMonth) {
        if (isIncome) currentIncome += converted
        else currentExpense += converted
        continue
      }

      if (isIncome) {
        previousFullIncome += converted
        if (rowDay <= samePeriodDay) previousSameIncome += converted
      } else {
        previousFullExpense += converted
        if (rowDay <= samePeriodDay) previousSameExpense += converted
      }
    }

    const round = (value: number) => Number(value.toFixed(2))

    return ok({
      currentDay,
      daysInMonth,
      daysInPreviousMonth,
      current: {
        income: round(currentIncome),
        expense: round(currentExpense),
      },
      previousSamePeriod: {
        income: round(previousSameIncome),
        expense: round(previousSameExpense),
      },
      previousFull: {
        income: round(previousFullIncome),
        expense: round(previousFullExpense),
      },
      monthTotal: round(currentExpense),
      dailyAverage: round(currentExpense / currentDay),
    })
  } catch (error) {
    console.error(error)
    return err("database", "Couldn't get the monthly pace try it later")
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
        .where(
          and(eq(bankAccounts.userId, userId), isNull(bankAccounts.deletedAt))
        ),
      getTransactionsWithCurrency(userId),
    ])

    const activeAccountIds = accountsResult.map((a) => a.id)

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

    // Sumar transacciones netas convertidas a la moneda por defecto del usuario.
    // Solo se consideran transacciones de cuentas activas (no soft-deleted).
    let transactionsSum = 0
    for (const tx of transactionsResult) {
      if (!activeAccountIds.includes(tx.accountId)) continue

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
      .where(
        and(eq(bankAccounts.userId, userId), isNull(bankAccounts.deletedAt))
      )

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
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.transactionType, "expense"),
          gte(transactions.transactionDate, startOfYear),
          lte(transactions.transactionDate, endOfYear),
          or(eq(categories.userId, userId), isNull(categories.userId)),
          isNull(bankAccounts.deletedAt)
        )
      )

    const ratesCache: Record<string, Record<string, number>> = {}

    const categoryMap = new Map<
      string,
      {
        categoryName: string
        categoryColor: string | null
        categoryIcon: string | null
        total: number
      }
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
