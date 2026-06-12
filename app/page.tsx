export const dynamic = "force-dynamic"
import { ChartAreaLegend } from "@/components/chart-area-legend"
import { cn, formatCurrency } from "@/lib/utils"
import { getDailyAverage, getNetBalance } from "@/server/bank-accounts/server"
import { getMonthlyFinancials } from "@/server/transactions/server"
import { Plus, Search } from "lucide-react"
import { FaMoneyBills } from "react-icons/fa6"
import { IoCalendarNumber } from "react-icons/io5"

export default async function Page() {
  const [data, netBalance, dailyAverage] = await Promise.all([
    getMonthlyFinancials(1),
    getNetBalance(1),
    getDailyAverage(1),
  ])

  return (
    <section>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <ChartAreaLegend data={data} />

          {/* Balance neto  */}
          <section className="flex flex-col gap-y-4">
            <div className="flex aspect-video flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
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
            <div className="flex aspect-video flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
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
        </div>

        {/* Área de visualización (simulando el mapa o lista) */}
        <div className="min-h-screen flex-1 rounded-xl border bg-muted/30 p-6 md:min-h-min">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Gestión de Inventario
            </h2>
            <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <Plus size={16} />
              Nuevo Registro
            </button>
          </div>

          {/* Placeholder de contenido */}
          <div className="flex flex-col gap-4 text-sm leading-loose text-muted-foreground">
            <p>
              Aquí se desplegará la lista de <strong>Places</strong> vinculados
              a sus respectivas
              <strong>Branches</strong>. Puedes usar el buscador superior para
              filtrar por ubicación física.
            </p>
            <div className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed">
              <div className="flex flex-col items-center gap-2 italic">
                <Search size={20} />
                Esperando datos de Firestore...
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
