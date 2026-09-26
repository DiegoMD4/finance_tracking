import { ExpensesByCategoryChart } from "@/components/ExpensesByCategoriesChart"
import { IncomesExpensesChart } from "@/components/IncomesExpensesChart"

import { ChartPieSimple } from "@/components/pie-chart"
import { cn, formatCurrency } from "@/lib/utils"
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
  const [data, netBalance, dailyAverage, fundsDistribution, expensesByCategories] =
    await Promise.all([
      getMonthlyFinancials(1),
      getNetBalance(1),
      getDailyAverage(1),
      getFundsDistribution(1),
      getExpensesByCategories(1),
    ])

  const monthlyFinancials = data.ok ? data.data : []
  const totalBalance = netBalance.ok ? netBalance.data : 0
  const daily = dailyAverage.ok ? dailyAverage.data : null
  const funds = fundsDistribution.ok ? fundsDistribution.data : []
  const expenses = expensesByCategories.ok ? expensesByCategories.data : null

  return (
    <section>
      <div className="flex flex-1 flex-col gap-4 p-6 max-sm:p-3">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <IncomesExpensesChart data={monthlyFinancials} />

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
                L. {formatCurrency(totalBalance)}
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
                <span>
                  L. {formatCurrency(daily?.dailyAverage ?? 0)}
                </span>
                <div className="flex flex-row gap-x-4">
                  <span className="text-xs font-normal text-muted-foreground">
                    This month&apos;s total spent: L.{" "}
                    {formatCurrency(daily?.monthTotal ?? 0)} •{" "}
                    {(daily?.currentDay ?? 0) > 1
                      ? `${daily?.currentDay ?? 0} days `
                      : `${daily?.currentDay ?? 0} day `}
                    tracked
                  </span>
                </div>
              </div>
            </div>
          </section>
          <ChartPieSimple data={funds} />
        </div>
        <ExpensesByCategoryChart data={expenses} />
        {/*   <ChartCashFlow data={cashFlow} /> */}
      </div>
    </section>
  )
}
