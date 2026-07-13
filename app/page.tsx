export const dynamic = "force-dynamic"
import { ChartAreaLegend } from "@/components/chart-area-legend"
import { ChartPieSimple } from "@/components/pie-chart"
import { cn, formatCurrency } from "@/lib/utils"
import {
  getDailyAverage,
  getFundsDistribution,
  getMonthlyFinancials,
  getNetBalance,
} from "@/server/dashboard/queries"

/* import { Plus, Search } from "lucide-react" */
import { FaMoneyBills } from "react-icons/fa6"
import { IoCalendarNumber } from "react-icons/io5"

export default async function Page() {
  const [data, netBalance, dailyAverage, fundsDistribution] = await Promise.all(
    [
      getMonthlyFinancials(1),
      getNetBalance(1),
      getDailyAverage(1),
      getFundsDistribution(1),
    ]
  )

  return (
    <section>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <ChartAreaLegend data={data} />

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
                  netBalance === 0
                    ? "text-foreground"
                    : netBalance >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                )}
              >
                L. {formatCurrency(netBalance)}
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
                <span>L. {formatCurrency(dailyAverage.dailyAverage)}</span>
                <div className="flex flex-row gap-x-4">
                  <span className="text-xs font-normal text-muted-foreground">
                    This month&apos;s total: L.{" "}
                    {formatCurrency(dailyAverage.monthTotal)} •{" "}
                    {dailyAverage.currentDay > 1
                      ? `${dailyAverage.currentDay} days `
                      : `${dailyAverage.currentDay} day `}
                    tracked
                  </span>
                </div>
              </div>
            </div>
          </section>
          <ChartPieSimple data={fundsDistribution} />
        </div>
      </div>
    </section>
  )
}
