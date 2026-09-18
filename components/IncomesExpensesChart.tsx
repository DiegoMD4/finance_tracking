"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"

export const description = "An area chart with a legend"

const formatAmount = (value: number) => `L.${formatCurrency(value)}`

const chartConfig = {
  income: {
    label: "Incomes",
    color: "var(--color-emerald-500)",
  },
  expense: {
    label: "Expenses",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig



interface IncomesExpensesChartProps {

  data: {
    monthNumber: number
    month: string
    income: number
    expense: number
  }[]
}

export function IncomesExpensesChart({ data }: IncomesExpensesChartProps) {
  const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
  const totalExpense = data.reduce((sum, item) => sum + item.expense, 0)
  const isPositive = totalIncome >= totalExpense
  const [hiddenSeries, setHiddenSeries] = useState<{ [key: string]: boolean }>({
    income: false,
    expense: false,
  })

  const handleLegendClick = (dataKey: string) => {
    setHiddenSeries((prev) => ({
      ...prev,
      [dataKey]: !prev[dataKey],
    }))
  }
/*   const savingRate =
    totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
 */

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incomes vs Expenses</CardTitle>
        <CardDescription>
          Comparisson between incomes and expenses on the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
              tickFormatter={formatAmount}
            />
            <ChartTooltip
              cursor={true}
              content={<ChartTooltipContent valueFormatter={formatAmount} />}
            />
            <Area
              dataKey="income"
              type="monotone"
              fill="var(--color-income)"
              fillOpacity={0.4}
              stroke="var(--color-income)"
              hide={hiddenSeries.income}
            />
            <Area
              dataKey="expense"
              type="monotone"
              fill="var(--color-expense)"
              fillOpacity={0.4}
              stroke="var(--color-expense)"
              hide={hiddenSeries.expense}
            />
            <ChartLegend
              content={
                <CustomLegend
                  hiddenSeries={hiddenSeries}
                  onLegendClick={handleLegendClick}
                />
              }
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              {isPositive ? (
                <>
                  Positive net balance for this period{" "}
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </>
              ) : (
                <>
                  Expenses exceed revenue{" "}
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </>
              )}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              {`${data[0]?.month ?? ""} - ${data[data.length - 1]?.month ?? ""} ${new Date().getFullYear()}`}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

function CustomLegend({
  hiddenSeries,
  onLegendClick,
}: {
  hiddenSeries: { [key: string]: boolean }
  onLegendClick: (dataKey: string) => void
}) {
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      <div
        onClick={() => onLegendClick("income")}
        className={`flex cursor-pointer items-center gap-1.5 transition-opacity ${
          hiddenSeries.income ? "line-through opacity-30" : "opacity-100"
        }`}
      >
        <span className="h-3 w-3 rounded-sm bg-(--color-income)" />
        <span className="text-sm font-medium">Incomes</span>
      </div>

      <div
        onClick={() => onLegendClick("expense")}
        className={`flex cursor-pointer items-center gap-1.5 transition-opacity ${
          hiddenSeries.expense ? "line-through opacity-30" : "opacity-100"
        }`}
      >
        <span className="h-3 w-3 rounded-sm bg-(--color-expense)" />
        <span className="text-sm font-medium">Expenses</span>
      </div>
    </div>
  )
}
