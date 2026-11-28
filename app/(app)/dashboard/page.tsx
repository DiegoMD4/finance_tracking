import { ExpensesByCategoryChart } from "@/components/ExpensesByCategoriesChart"
import { IncomesExpensesChart } from "@/components/IncomesExpensesChart"

import { ChartPieSimple } from "@/components/pie-chart"
import { ErrorBanner } from "@/components/ui/error-banner"
import {
  computeCashRunway,
  computeMonthlyNet,
  computeProjectedSpend,
} from "@/lib/dashboard/metrics"
import { requireUserId } from "@/lib/jwt"
import { formatCurrency, type Currency } from "@/lib/utils"
import {
  getExpensesByCategories,
  getFundsDistribution,
  getMonthlyFinancials,
  getMonthlyPace,
  getNetBalance,
} from "@/server/dashboard/queries"
import { getUserDefaultCurrency } from "@/server/users/queries"
import {
  FaChartLine,
  FaHourglassHalf,
  FaMoneyBills,
  FaWallet,
} from "react-icons/fa6"
import { IoCalendarNumber } from "react-icons/io5"

import { MetricCard } from "./_components/MetricCard"

type QueryError = {
  query: string
  message: string
}

export const revalidate = 60

function formatSignedPercent(value: number) {
  const rounded = Number(value.toFixed(1))
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`
}

export default async function Page() {
  const userId = await requireUserId()

  const currencyResult = await getUserDefaultCurrency(userId)
  const currency: Currency =
    currencyResult.success && currencyResult.data
      ? (currencyResult.data as Currency)
      : "HNL"

  const [
    data,
    netBalance,
    monthlyPace,
    fundsDistribution,
    expensesByCategories,
  ] = await Promise.all([
    getMonthlyFinancials(userId, currency),
    getNetBalance(userId, currency),
    getMonthlyPace(userId, currency),
    getFundsDistribution(userId, currency),
    getExpensesByCategories(userId, currency),
  ])

  const queryErrors: QueryError[] = []
  if (!data.ok)
    queryErrors.push({
      query: "monthlyFinancials",
      message: data.error.message,
    })
  if (!netBalance.ok)
    queryErrors.push({ query: "netBalance", message: netBalance.error.message })
  if (!monthlyPace.ok)
    queryErrors.push({
      query: "monthlyPace",
      message: monthlyPace.error.message,
    })
  if (!fundsDistribution.ok)
    queryErrors.push({
      query: "fundsDistribution",
      message: fundsDistribution.error.message,
    })
  if (!expensesByCategories.ok)
    queryErrors.push({
      query: "expensesByCategories",
      message: expensesByCategories.error.message,
    })

  const monthlyFinancials = data.ok ? data.data : []
  const totalBalance = netBalance.ok ? netBalance.data : 0
  const pace = monthlyPace.ok ? monthlyPace.data : null
  const funds = fundsDistribution.ok ? fundsDistribution.data : []
  const expenses = expensesByCategories.ok ? expensesByCategories.data : null

  const monthlyNet = pace ? computeMonthlyNet(pace) : null
  const runway = computeCashRunway(totalBalance, pace?.dailyAverage ?? 0)
  const projection = pace ? computeProjectedSpend(pace) : null

  const balanceTone =
    totalBalance === 0
      ? "text-foreground"
      : totalBalance > 0
        ? "text-emerald-500"
        : "text-red-500"

  const netTone =
    !monthlyNet || monthlyNet.net === 0
      ? "text-foreground"
      : monthlyNet.net > 0
        ? "text-emerald-500"
        : "text-red-500"

  const runwayValue =
    runway.days === null
      ? "—"
      : `${runway.days}${runway.capped ? "+" : ""} ${runway.days === 1 ? "day" : "days"}`

  return (
    <section>
      {queryErrors.length > 0 && <ErrorBanner errors={queryErrors} />}
      {/* max-sm:p-3*/}
      <div className="fc-enter flex flex-1 flex-col gap-4 p-6 max-sm:p-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <IncomesExpensesChart data={monthlyFinancials} currency={currency} />

          {/* Balance neto + gasto diario */}
          <section className="flex min-h-0 flex-col gap-y-4">
            <MetricCard
              icon={<FaMoneyBills className="text-primary" size={24} />}
              label="TOTAL NET BALANCE"
              value={formatCurrency(totalBalance, currency)}
              valueClassName={balanceTone}
            />
            <MetricCard
              icon={<IoCalendarNumber className="text-primary" size={24} />}
              label="DAILY SPENT AVERAGE"
              value={
                <span>{formatCurrency(pace?.dailyAverage ?? 0, currency)}</span>
              }
              footer={
                <>
                  This month&apos;s total spent:
                  {" " + formatCurrency(pace?.monthTotal ?? 0, currency)} •{" "}
                  {(pace?.currentDay ?? 0) > 1
                    ? `${pace?.currentDay ?? 0} days `
                    : `${pace?.currentDay ?? 0} day `}
                  tracked
                </>
              }
            />
          </section>

          <ChartPieSimple data={funds} currency={currency} />
        </div>

        {/* Métricas del mes */}
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <MetricCard
            icon={<FaWallet className="text-primary" size={24} />}
            label="MONTHLY NET"
            value={
              <span>{formatCurrency(monthlyNet?.net ?? 0, currency)}</span>
            }
            valueClassName={netTone}
            footer={
              monthlyNet ? (
                <>
                  {monthlyNet.deltaPercent !== null
                    ? formatSignedPercent(monthlyNet.deltaPercent)
                    : formatCurrency(monthlyNet.delta, currency)}{" "}
                  vs same period last month
                  {monthlyNet.savingsRate !== null
                    ? ` · ${formatSignedPercent(monthlyNet.savingsRate)} savings rate`
                    : ""}
                </>
              ) : (
                "No data for this month"
              )
            }
          />

          <MetricCard
            icon={<FaHourglassHalf className="text-primary" size={24} />}
            label="CASH RUNWAY"
            value={<span>{runwayValue}</span>}
            valueClassName={
              runway.days !== null && runway.days < 30
                ? "text-red-500"
                : "text-foreground"
            }
            footer={
              runway.days === null
                ? "No spending recorded this month"
                : `at current spending pace · ${formatCurrency(totalBalance, currency)} available`
            }
          />

          <MetricCard
            icon={<FaChartLine className="text-primary" size={24} />}
            label="PROJECTED MONTH SPEND"
            value={
              <span>
                {formatCurrency(projection?.projected ?? 0, currency)}
              </span>
            }
            valueClassName="text-foreground"
            footer={
              projection && pace ? (
                projection.deltaPercent !== null ? (
                  <>
                    <span
                      className={
                        projection.delta > 0
                          ? "text-red-500"
                          : projection.delta < 0
                            ? "text-emerald-500"
                            : undefined
                      }
                    >
                      {formatSignedPercent(projection.deltaPercent)}
                    </span>
                    {" vs last month ("}
                    {formatCurrency(pace.previousFull.expense, currency)}
                    {")"}
                  </>
                ) : (
                  "No spending last month to compare"
                )
              ) : (
                "No data for this month"
              )
            }
          />
        </div>

        <ExpensesByCategoryChart data={expenses} currency={currency} />
        {/*   <ChartCashFlow data={cashFlow} /> */}
      </div>
    </section>
  )
}
