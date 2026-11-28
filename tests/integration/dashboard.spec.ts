import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  bankAccounts,
  categories,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { sql } from "drizzle-orm"
import { getExchangeRates } from "@/lib/currency"
import {
  getExpensesByCategories,
  getFundsDistribution,
  getMonthlyFinancials,
  getMonthlyPace,
  getNetBalance,
} from "@/server/dashboard/queries"

vi.mock("@/lib/currency", () => ({
  getExchangeRates: vi.fn(),
}))

const mockGetExchangeRates = vi.mocked(getExchangeRates)

let accountSequence = 0

async function createTestUser(
  email = "dashboard@test.com",
  defaultCurrency = "HNL"
): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({
      name: "Dashboard User",
      email,
      password: "hashed",
      defaultCurrency,
    })
    .$returningId()

  return user.id
}

async function insertTestAccount({
  userId,
  bankName = "Banco Test",
  bankAccountType = "savings",
  accountCurrency = "HNL",
  openingBalance = "0.00",
}: {
  userId: number
  bankName?: string
  bankAccountType?: string
  accountCurrency?: string
  openingBalance?: string
}): Promise<number> {
  accountSequence += 1

  const [account] = await db
    .insert(bankAccounts)
    .values({
      accountNumber: `DASH-${accountSequence}`,
      bankName,
      accountName: "Cuenta Dashboard",
      bankAccountType,
      accountCurrency,
      openingBalance,
      userId,
    })
    .$returningId()

  return account.id
}

async function insertTestCategory({
  userId,
  name = "Categoría Test",
  icon = "tag",
  color = "#64748b",
}: {
  userId: number | null
  name?: string
  icon?: string | null
  color?: string | null
}): Promise<number> {
  const [category] = await db
    .insert(categories)
    .values({
      name,
      icon,
      color,
      userId,
    })
    .$returningId()

  return category.categoryId
}

async function insertTestTransaction({
  userId,
  accountId,
  categoryId,
  amount = "100.00",
  transactionType = "expense",
  transactionDate = new Date(),
  transactionCurrency = "HNL",
  amountInDefaultCurrency = amount,
  defaultCurrencyAtTransaction = "HNL",
}: {
  userId: number
  accountId: number
  categoryId: number
  amount?: string
  transactionType?: "income" | "expense"
  transactionDate?: Date
  transactionCurrency?: string
  amountInDefaultCurrency?: string
  defaultCurrencyAtTransaction?: string
}): Promise<number> {
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId,
      accountId,
      categoryId,
      amount,
      transactionType,
      transactionDate,
      transactionCurrency,
      amountInDefaultCurrency,
      defaultCurrencyAtTransaction,
    })
    .$returningId()

  return transaction.id
}

function dateInMonth(offsetMonths: number, day = 10): Date {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths,
    day,
    0,
    0,
    0
  )
}

function monthNumberForOffset(offsetMonths: number): number {
  const now = new Date()
  return (
    new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1).getMonth() + 1
  )
}

function monthNameForOffset(offsetMonths: number): string {
  const now = new Date()
  const date = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  )

  return date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
}

/**
 * Fecha actual según la base de datos. Se usa en los tests que dependen del
 * "hoy" real para insertar transacciones dentro del mes en curso.
 */
async function getDbToday(): Promise<Date> {
  const [row] = await db
    .select({ today: sql<string>`DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d')` })
    .from(users)
    .limit(1)

  const [year, month, day] = row.today.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0)
}

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  mockGetExchangeRates.mockResolvedValue({ HNL: 1 })
})

describe("getMonthlyFinancials", () => {
  it("D-01:groups income and expenses by month", async () => {
    // Dado: un usuario con transacciones en el mes actual y los dos anteriores
    const userId = await createTestUser("d01@test.com")
    const accountId = await insertTestAccount({ userId })
    const categoryId = await insertTestCategory({ userId })

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "1000.00",
      transactionType: "income",
      transactionDate: dateInMonth(0, 10),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "250.00",
      transactionType: "expense",
      transactionDate: dateInMonth(0, 12),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "500.00",
      transactionType: "income",
      transactionDate: dateInMonth(-1, 10),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "100.00",
      transactionType: "expense",
      transactionDate: dateInMonth(-1, 15),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "50.00",
      transactionType: "expense",
      transactionDate: dateInMonth(-2, 10),
    })

    // Cuando: se piden los financieros mensuales
    const result = await getMonthlyFinancials(userId, "HNL")

    // Entonces: hay una entrada por mes con los totales acumulados
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(3)

    const byMonth = new Map(
      result.data.map((entry) => [entry.monthNumber, entry])
    )

    const current = byMonth.get(monthNumberForOffset(0))
    expect(current?.month).toBe(monthNameForOffset(0))
    expect(current?.income).toBe(1000)
    expect(current?.expense).toBe(250)

    const previous = byMonth.get(monthNumberForOffset(-1))
    expect(previous?.month).toBe(monthNameForOffset(-1))
    expect(previous?.income).toBe(500)
    expect(previous?.expense).toBe(100)

    const twoMonthsAgo = byMonth.get(monthNumberForOffset(-2))
    expect(twoMonthsAgo?.month).toBe(monthNameForOffset(-2))
    expect(twoMonthsAgo?.income).toBe(0)
    expect(twoMonthsAgo?.expense).toBe(50)
  })

  it("D-02:converts amounts to default currency", async () => {
    // Dado: una transacción en USD y una tasa USD -> HNL de 24.5
    const userId = await createTestUser("d02@test.com", "HNL")
    const accountId = await insertTestAccount({ userId })
    const categoryId = await insertTestCategory({ userId })
    mockGetExchangeRates.mockResolvedValue({ HNL: 24.5 })

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "100.00",
      transactionType: "income",
      transactionDate: dateInMonth(0),
      transactionCurrency: "USD",
      amountInDefaultCurrency: "100.00",
      defaultCurrencyAtTransaction: "USD",
    })

    // Cuando: se piden los financieros mensuales en HNL
    const result = await getMonthlyFinancials(userId, "HNL")

    // Entonces: el monto se convirtió con la tasa
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(1)
    expect(result.data[0].income).toBe(2450)
    expect(result.data[0].expense).toBe(0)
    expect(mockGetExchangeRates).toHaveBeenCalledWith("USD", ["HNL"])
  })

  it("D-03:without transactions returns empty array", async () => {
    // Dado: un usuario sin transacciones
    const userId = await createTestUser("d03@test.com")

    // Cuando: se piden los financieros mensuales
    const result = await getMonthlyFinancials(userId, "HNL")

    // Entonces: no hay meses que reportar
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toEqual([])
  })

  it("D-03b:orders months chronologically across a year boundary", async () => {
    // Dado: febrero de 2026, con transacciones de diciembre, enero y febrero
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0))

    try {
      const userId = await createTestUser("d03b@test.com")
      const accountId = await insertTestAccount({ userId })
      const categoryId = await insertTestCategory({ userId })

      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "100.00",
        transactionType: "income",
        transactionDate: new Date(2025, 11, 10),
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "50.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 0, 10),
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "200.00",
        transactionType: "income",
        transactionDate: new Date(2026, 1, 10),
      })

      // Cuando: se piden los financieros mensuales
      const result = await getMonthlyFinancials(userId, "HNL")

      // Entonces: el orden es diciembre 2025 -> enero 2026 -> febrero 2026
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Expected ok result")

      expect(
        result.data.map((entry) => `${entry.year}-${entry.monthNumber}`)
      ).toEqual(["2025-12", "2026-1", "2026-2"])
      expect(result.data[0].month).toBe("December")
      expect(result.data[2].month).toBe("February")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("getMonthlyPace", () => {
  it("D-04:calculates total and daily average of current month", async () => {
    // Dado: dos gastos del mes actual y un ingreso que no debe sumar
    const userId = await createTestUser("d04@test.com")
    const accountId = await insertTestAccount({ userId })
    const categoryId = await insertTestCategory({ userId })
    const today = await getDbToday()

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "100.00",
      transactionType: "expense",
      transactionDate: today,
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "50.00",
      transactionType: "expense",
      transactionDate: today,
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "999.00",
      transactionType: "income",
      transactionDate: today,
    })

    // Cuando: se pide el ritmo mensual
    const result = await getMonthlyPace(userId, "HNL")

    // Entonces: solo se suman los gastos y se divide entre el día actual
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.monthTotal).toBe(150)
    expect(result.data.currentDay).toBe(new Date().getDate())
    expect(result.data.current).toEqual({ income: 999, expense: 150 })
    expect(result.data.dailyAverage).toBe(
      Number((150 / result.data.currentDay).toFixed(2))
    )
  })

  it("D-05:without monthly expenses returns totals zero", async () => {
    // Dado: un gasto del mes anterior, fuera del rango del query
    const userId = await createTestUser("d05@test.com")
    const accountId = await insertTestAccount({ userId })
    const categoryId = await insertTestCategory({ userId })

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "500.00",
      transactionType: "expense",
      transactionDate: dateInMonth(-1, 15),
    })

    // Cuando: se pide el ritmo mensual
    const result = await getMonthlyPace(userId, "HNL")

    // Entonces: no hay gastos del mes actual, pero sí del mes anterior
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data.monthTotal).toBe(0)
    expect(result.data.dailyAverage).toBe(0)
    expect(result.data.current.expense).toBe(0)
    expect(result.data.previousFull.expense).toBe(500)
  })

  it("D-15:limits previous month to the same day of the current month", async () => {
    // Dado: 15 de junio de 2026, con gastos de mayo antes y después del día 15
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))

    try {
      const userId = await createTestUser("d15@test.com")
      const accountId = await insertTestAccount({ userId })
      const categoryId = await insertTestCategory({ userId })

      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "1000.00",
        transactionType: "income",
        transactionDate: new Date(2026, 5, 10),
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "250.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 5, 12),
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "100.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 4, 10),
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "200.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 4, 20),
      })

      // Cuando: se pide el ritmo mensual
      const result = await getMonthlyPace(userId, "HNL")

      // Entonces: el mismo tramo de mayo corta en el día 15
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Expected ok result")

      expect(result.data.currentDay).toBe(15)
      expect(result.data.daysInMonth).toBe(30)
      expect(result.data.daysInPreviousMonth).toBe(31)
      expect(result.data.current).toEqual({ income: 1000, expense: 250 })
      expect(result.data.previousSamePeriod).toEqual({
        income: 0,
        expense: 100,
      })
      expect(result.data.previousFull).toEqual({ income: 0, expense: 300 })
      expect(result.data.dailyAverage).toBe(Number((250 / 15).toFixed(2)))
    } finally {
      vi.useRealTimers()
    }
  })

  it("D-16:caps the same-period comparison at the previous month's last day", async () => {
    // Dado: 31 de marzo de 2026, con un gasto el 28 de febrero
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 2, 31, 12, 0, 0))

    try {
      const userId = await createTestUser("d16@test.com")
      const accountId = await insertTestAccount({ userId })
      const categoryId = await insertTestCategory({ userId })

      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "70.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 1, 28),
      })

      // Cuando: se pide el ritmo mensual
      const result = await getMonthlyPace(userId, "HNL")

      // Entonces: el tope es el día 28 y el gasto entra completo en ambos cortes
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Expected ok result")

      expect(result.data.currentDay).toBe(31)
      expect(result.data.daysInPreviousMonth).toBe(28)
      expect(result.data.previousSamePeriod.expense).toBe(70)
      expect(result.data.previousFull.expense).toBe(70)
    } finally {
      vi.useRealTimers()
    }
  })

  it("D-17:converts current and previous month amounts", async () => {
    // Dado: un ingreso en USD del mes actual y un gasto del mes anterior
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))
    mockGetExchangeRates.mockResolvedValue({ HNL: 24.5 })

    try {
      const userId = await createTestUser("d17@test.com", "HNL")
      const accountId = await insertTestAccount({ userId })
      const categoryId = await insertTestCategory({ userId })

      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "100.00",
        transactionType: "income",
        transactionDate: new Date(2026, 5, 10),
        transactionCurrency: "USD",
        amountInDefaultCurrency: "100.00",
        defaultCurrencyAtTransaction: "USD",
      })
      await insertTestTransaction({
        userId,
        accountId,
        categoryId,
        amount: "50.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 4, 10),
      })

      // Cuando: se pide el ritmo mensual en HNL
      const result = await getMonthlyPace(userId, "HNL")

      // Entonces: el ingreso USD se convierte y el gasto anterior se conserva
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Expected ok result")

      expect(result.data.current.income).toBe(2450)
      expect(result.data.previousFull.expense).toBe(50)
      expect(mockGetExchangeRates).toHaveBeenCalledWith("USD", ["HNL"])
    } finally {
      vi.useRealTimers()
    }
  })

  it("D-18:ignores soft-deleted accounts and other users", async () => {
    // Dado: una cuenta activa, una eliminada y transacciones de otro usuario
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))

    try {
      const userId = await createTestUser("d18@test.com")
      const otherUserId = await createTestUser("d18-other@test.com")
      const activeAccountId = await insertTestAccount({ userId })
      const deletedAccountId = await insertTestAccount({
        userId,
        bankName: "Banco Eliminado",
      })
      const otherAccountId = await insertTestAccount({ userId: otherUserId })
      const categoryId = await insertTestCategory({ userId })

      await insertTestTransaction({
        userId,
        accountId: activeAccountId,
        categoryId,
        amount: "100.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 5, 10),
      })
      await insertTestTransaction({
        userId,
        accountId: deletedAccountId,
        categoryId,
        amount: "999.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 5, 10),
      })
      await insertTestTransaction({
        userId: otherUserId,
        accountId: otherAccountId,
        categoryId,
        amount: "888.00",
        transactionType: "expense",
        transactionDate: new Date(2026, 5, 10),
      })

      await db
        .update(bankAccounts)
        .set({ deletedAt: new Date() })
        .where(sql`${bankAccounts.id} = ${deletedAccountId}`)

      // Cuando: se pide el ritmo mensual
      const result = await getMonthlyPace(userId, "HNL")

      // Entonces: solo cuenta la transacción de la cuenta activa del usuario
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Expected ok result")

      expect(result.data.current.expense).toBe(100)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("getNetBalance", () => {
  it("D-06:sums opening balances and income and subtracts expenses", async () => {
    // Dado: una cuenta con saldo inicial y dos transacciones
    const userId = await createTestUser("d06@test.com")
    const accountId = await insertTestAccount({
      userId,
      openingBalance: "1000.00",
    })
    const categoryId = await insertTestCategory({ userId })

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "500.00",
      transactionType: "income",
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "200.00",
      transactionType: "expense",
    })

    // Cuando: se calcula el saldo neto
    const result = await getNetBalance(userId, "HNL")

    // Entonces: opening + income - expense
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toBe(1300)
    expect(mockGetExchangeRates).not.toHaveBeenCalled()
  })

  it("D-07:converts accounts and transactions to default currency", async () => {
    // Dado: una cuenta USD, una cuenta EUR y una transacción en USD
    const userId = await createTestUser("d07@test.com", "HNL")
    const usdAccountId = await insertTestAccount({
      userId,
      accountCurrency: "USD",
      openingBalance: "100.00",
    })
    await insertTestAccount({
      userId,
      accountCurrency: "EUR",
      openingBalance: "50.00",
    })
    const categoryId = await insertTestCategory({ userId })

    mockGetExchangeRates.mockImplementation(async (from) => {
      if (from === "USD") return { HNL: 24.5 }
      if (from === "EUR") return { HNL: 25 }
      return { HNL: 1 }
    })

    await insertTestTransaction({
      userId,
      accountId: usdAccountId,
      categoryId,
      amount: "10.00",
      transactionType: "income",
      transactionCurrency: "USD",
      amountInDefaultCurrency: "10.00",
      defaultCurrencyAtTransaction: "USD",
    })

    // Cuando: se calcula el saldo neto en HNL
    const result = await getNetBalance(userId, "HNL")

    // Entonces: 100 USD * 24.5 + 50 EUR * 25 + 10 USD * 24.5
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toBe(3945)
    expect(mockGetExchangeRates).toHaveBeenCalledWith("USD", ["HNL"])
    expect(mockGetExchangeRates).toHaveBeenCalledWith("EUR", ["HNL"])
  })

  it("D-08:without accounts returns zero", async () => {
    // Dado: un usuario sin cuentas ni transacciones
    const userId = await createTestUser("d08@test.com")

    // Cuando: se calcula el saldo neto
    const result = await getNetBalance(userId, "HNL")

    // Entonces: el saldo es cero
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toBe(0)
  })
})

describe("getFundsDistribution", () => {
  it("D-09:distributes balance by account", async () => {
    // Dado: dos cuentas con saldos distintos
    const userId = await createTestUser("d09@test.com")
    const firstAccountId = await insertTestAccount({
      userId,
      bankName: "Banco A",
      bankAccountType: "savings",
      openingBalance: "1000.00",
    })
    await insertTestAccount({
      userId,
      bankName: "Banco B",
      bankAccountType: "checking",
      openingBalance: "500.00",
    })
    const categoryId = await insertTestCategory({ userId })

    await insertTestTransaction({
      userId,
      accountId: firstAccountId,
      categoryId,
      amount: "500.00",
      transactionType: "income",
    })
    await insertTestTransaction({
      userId,
      accountId: firstAccountId,
      categoryId,
      amount: "200.00",
      transactionType: "expense",
    })

    // Cuando: se pide la distribución de fondos
    const result = await getFundsDistribution(userId, "HNL")

    // Entonces: cada cuenta reporta su saldo actual
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(2)

    const first = result.data.find((item) => item.name === "Banco A")
    expect(first).toEqual({
      name: "Banco A",
      type: "savings",
      value: 1300,
    })

    const second = result.data.find((item) => item.name === "Banco B")
    expect(second).toEqual({
      name: "Banco B",
      type: "checking",
      value: 500,
    })
  })

  it("D-10:account with negative balance reports zero", async () => {
    // Dado: una cuenta cuyo gasto supera el saldo inicial
    const userId = await createTestUser("d10@test.com")
    const accountId = await insertTestAccount({
      userId,
      openingBalance: "100.00",
    })
    const categoryId = await insertTestCategory({ userId })

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "300.00",
      transactionType: "expense",
    })

    // Cuando: se pide la distribución de fondos
    const result = await getFundsDistribution(userId, "HNL")

    // Entonces: el valor se recorta a cero
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(1)
    expect(result.data[0].value).toBe(0)
  })

  it("D-11:without accounts returns empty array", async () => {
    // Dado: un usuario sin cuentas
    const userId = await createTestUser("d11@test.com")

    // Cuando: se pide la distribución de fondos
    const result = await getFundsDistribution(userId, "HNL")

    // Entonces: no hay cuentas que distribuir
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toEqual([])
  })
})

describe("getExpensesByCategories", () => {
  it("D-12:groups yearly expenses by category", async () => {
    // Dado: dos categorías con gastos del año actual
    const userId = await createTestUser("d12@test.com")
    const accountId = await insertTestAccount({ userId })
    const foodCategoryId = await insertTestCategory({
      userId,
      name: "Comida",
      icon: "utensils",
      color: "#ef4444",
    })
    const transportCategoryId = await insertTestCategory({
      userId,
      name: "Transporte",
      icon: "car",
      color: "#3b82f6",
    })
    const currentYear = new Date().getFullYear()

    await insertTestTransaction({
      userId,
      accountId,
      categoryId: foodCategoryId,
      amount: "100.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 5, 15),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: foodCategoryId,
      amount: "50.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 6, 10),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: transportCategoryId,
      amount: "30.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 5, 20),
    })
    // No debe sumar: es ingreso
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: foodCategoryId,
      amount: "500.00",
      transactionType: "income",
      transactionDate: new Date(currentYear, 5, 15),
    })
    // No debe sumar: es de otro año
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: foodCategoryId,
      amount: "999.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear - 1, 5, 15),
    })

    // Cuando: se piden los gastos por categoría
    const result = await getExpensesByCategories(userId, "HNL")

    // Entonces: se agrupan por categoría con sus metadatos
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(2)

    const food = result.data.find((item) => item.categoryName === "Comida")
    expect(food).toEqual({
      categoryName: "Comida",
      categoryColor: "#ef4444",
      categoryIcon: "utensils",
      total_amount: 150,
    })

    const transport = result.data.find(
      (item) => item.categoryName === "Transporte"
    )
    expect(transport).toEqual({
      categoryName: "Transporte",
      categoryColor: "#3b82f6",
      categoryIcon: "car",
      total_amount: 30,
    })
  })

  it("D-13:includes global categories and excludes others' categories", async () => {
    // Dado: una categoría global, una propia y una de otro usuario
    const userId = await createTestUser("d13@test.com")
    const otherUserId = await createTestUser("d13-other@test.com")
    const accountId = await insertTestAccount({ userId })
    const globalCategoryId = await insertTestCategory({
      userId: null,
      name: "Global",
    })
    const ownCategoryId = await insertTestCategory({
      userId,
      name: "Propia",
    })
    const foreignCategoryId = await insertTestCategory({
      userId: otherUserId,
      name: "Ajena",
    })
    const currentYear = new Date().getFullYear()

    await insertTestTransaction({
      userId,
      accountId,
      categoryId: globalCategoryId,
      amount: "75.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 5, 15),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: ownCategoryId,
      amount: "25.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 5, 15),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId: foreignCategoryId,
      amount: "999.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear, 5, 15),
    })

    // Cuando: se piden los gastos por categoría
    const result = await getExpensesByCategories(userId, "HNL")

    // Entonces: la global y la propia aparecen, la ajena no
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")

    expect(result.data).toHaveLength(2)
    expect(result.data.map((item) => item.categoryName).sort()).toEqual([
      "Global",
      "Propia",
    ])
  })

  it("D-14:without yearly expenses returns empty array", async () => {
    // Dado: un usuario con un ingreso y un gasto de otro año
    const userId = await createTestUser("d14@test.com")
    const accountId = await insertTestAccount({ userId })
    const categoryId = await insertTestCategory({ userId })
    const currentYear = new Date().getFullYear()

    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "500.00",
      transactionType: "income",
      transactionDate: new Date(currentYear, 5, 15),
    })
    await insertTestTransaction({
      userId,
      accountId,
      categoryId,
      amount: "100.00",
      transactionType: "expense",
      transactionDate: new Date(currentYear - 1, 5, 15),
    })

    // Cuando: se piden los gastos por categoría
    const result = await getExpensesByCategories(userId, "HNL")

    // Entonces: no hay gastos del año actual
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Expected ok result")
    expect(result.data).toEqual([])
  })
})
