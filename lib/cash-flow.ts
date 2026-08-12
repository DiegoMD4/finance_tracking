export type CashFlowGranularity = "day" | "week" | "month"

export interface CashFlowTransaction {
  amount: string | number
  transactionType: "income" | "expense"
  createdAt: Date
}

export interface CashFlowPoint {
  period: string
  periodLabel: string
  balance: number
  isNegative: boolean
}

function startOfIsoWeek(date: Date): Date {
  const start = new Date(date)
  const day = start.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  return start
}

function getPeriodKeyAndLabel(
  date: Date,
  granularity: CashFlowGranularity
): { key: string; label: string } {
  if (granularity === "month") {
    const year = date.getFullYear()
    const month = date.getMonth()
    const key = `${year}-${String(month + 1).padStart(2, "0")}`
    const label = date.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    })
    return { key, label }
  }

  if (granularity === "week") {
    const weekStart = startOfIsoWeek(date)
    const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`
    const label = `Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    return { key, label }
  }

  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const label = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
  return { key, label }
}

export function computeCashFlow(
  openingBalance: number,
  transactions: CashFlowTransaction[],
  granularity: CashFlowGranularity
): CashFlowPoint[] {
  const sorted = [...transactions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )

  if (sorted.length === 0) {
    const { key, label } = getPeriodKeyAndLabel(new Date(), granularity)
    return [
      {
        period: key,
        periodLabel: label,
        balance: openingBalance,
        isNegative: openingBalance < 0,
      },
    ]
  }

  let runningBalance = openingBalance
  const pointsByPeriod = new Map<string, CashFlowPoint>()

  for (const transaction of sorted) {
    const delta =
      transaction.transactionType === "income"
        ? Number(transaction.amount)
        : -Number(transaction.amount)
    runningBalance += delta

    const { key, label } = getPeriodKeyAndLabel(
      transaction.createdAt,
      granularity
    )

    pointsByPeriod.set(key, {
      period: key,
      periodLabel: label,
      balance: runningBalance,
      isNegative: runningBalance < 0,
    })
  }

  return [...pointsByPeriod.values()].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0
  )
}
