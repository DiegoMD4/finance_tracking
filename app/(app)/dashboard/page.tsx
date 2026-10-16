import { ExpensesByCategoryChart } from "@/components/ExpensesByCategoriesChart"
import { IncomesExpensesChart } from "@/components/IncomesExpensesChart"

import { ChartPieSimple } from "@/components/pie-chart"
import { cn, formatCurrency, type Currency } from "@/lib/utils"
import { requireUserId } from "@/lib/jwt"
import { getUserDefaultCurrency } from "@/server/users/queries"
import {
  getDailyAverage,
  getExpensesByCategories,
  getFundsDistribution,
  getMonthlyFinancials,
  getNetBalance,
} from "@/server/dashboard/queries"

export const revalidate = 60
/* import { Plus, Search } from "lucide-react" */
import { FaMoneyBills } from "react-icons/fa6"
import { IoCalendarNumber } from "react-icons/io5"

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
    dailyAverage,
    fundsDistribution,
    expensesByCategories,
  ] = await Promise.all([
    getMonthlyFinancials(userId, currency),
    getNetBalance(userId, currency),
    getDailyAverage(userId, currency),
    getFundsDistribution(userId, currency),
    getExpensesByCategories(userId, currency),
  ])

  const monthlyFinancials = data.ok ? data.data : []
  const totalBalance = netBalance.ok ? netBalance.data : 0
  const daily = dailyAverage.ok ? dailyAverage.data : null
  const funds = fundsDistribution.ok ? fundsDistribution.data : []
  const expenses = expensesByCategories.ok ? expensesByCategories.data : null

  return (
    <section>
      {/* max-sm:p-3*/}
      <div className="fc-enter flex flex-1 flex-col gap-4 p-6 max-sm:p-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <IncomesExpensesChart data={monthlyFinancials} currency={currency} />

          {/* Balance neto  */}
          <section className="flex min-h-0 flex-col gap-y-4">
            <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <FaMoneyBills className="text-primary" size={24} />
                <span className="text-xs font-bold text-muted-foreground">
                  TOTAL NET BALANCE
                </span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  totalBalance === 0
                    ? "text-foreground"
                    : totalBalance >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                )}
              >
                {formatCurrency(totalBalance, currency)}
              </div>
            </div>
            {/* GASTO DIARIO */}
            <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <IoCalendarNumber className="text-primary" size={24} />
                <span className="text-xs font-bold text-muted-foreground">
                  DAILY SPENT AVERAGE
                </span>
              </div>
              <div className="flex flex-col gap-y-2 text-2xl font-bold">
                <span>{formatCurrency(daily?.dailyAverage ?? 0, currency)}</span>
                <div className="flex flex-row gap-x-4">
                  <span className="text-xs font-normal text-muted-foreground">
                    This month&apos;s total spent:
                    {" " + formatCurrency(daily?.monthTotal ?? 0, currency)} •{" "}
                    {(daily?.currentDay ?? 0) > 1
                      ? `${daily?.currentDay ?? 0} days `
                      : `${daily?.currentDay ?? 0} day `}
                    tracked
                  </span>
                </div>
              </div>
            </div>
          </section>
          <ChartPieSimple data={funds} currency={currency} />
        </div>
        <ExpensesByCategoryChart data={expenses} currency={currency} />
        {/*   <ChartCashFlow data={cashFlow} /> */}
      </div>
    </section>
  )
}
