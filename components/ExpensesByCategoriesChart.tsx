"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, Rectangle, XAxis, YAxis } from "recharts"
import type { BarShapeProps } from "recharts"

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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getCategoryIcon } from "@/lib/category-icons"
import { formatCurrency } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export const description = "A horizontal bar chart"

const chartConfig = {
  amount: {
    label: "Amount",
  },
} satisfies ChartConfig

interface ExpensesByCategoriesChartProps {
  data:
    | {
        categoryName: string
        categoryColor: string | null
        categoryIcon: string | null
        total_amount: number
      }[]
    | null
}

export function ExpensesByCategoryChart({
  data,
}: ExpensesByCategoriesChartProps) {
  const newChartData = (data ?? []).map((item) => ({
    category: item.categoryName,
    amount: item.total_amount,
    icon: item.categoryIcon,
    fill: item.categoryColor ?? "var(--chart-1)",
  }))

  const isMobile = useIsMobile()
  const renderCategoryTick = (props: {
    x: string | number
    y: string | number
    index: number
  }) => {
    const { x, y, index } = props
    const item = newChartData[index]
    if (!item) return null

    const Icon = getCategoryIcon(item.icon)
    const label =
      item.category && item.category.length > 16
        ? `${item.category.slice(0, 16)}…`
        : item.category

    return (
      <g transform={`translate(${x},${y})`}>
        <Icon
          x={isMobile ? -20 : -150}
          y={-8}
          width={16}
          height={16}
          color={item.fill}
        />
        {!isMobile && (
          <text
            x={-128}
            y={4}
            textAnchor="start"
            className="fill-foreground text-xs"
          >
            {label}
          </text>
        )}
      </g>
    )
  }

  const renderBarShape = (props: BarShapeProps) => {
    const { payload, ...rectangleProps } = props
    const fill = (payload as { fill?: string } | undefined)?.fill

    return <Rectangle {...rectangleProps} fill={fill} />
  }

  const categoryWithHighestValue = () => {
    const top = newChartData.reduce(
      (max, item) => (Number(item.amount) > Number(max.amount) ? item : max),
      newChartData[0] ?? { amount: -Infinity, category: undefined }
    )
    return { highestValue: top.amount, categoryName: top.category }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses by category</CardTitle>
        <CardDescription>Throughout {new Date().getFullYear()}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={newChartData}
            layout="vertical"
            /* barCategoryGap={isMobile ? 16 : "10%"} */
            margin={{
              left: 0,
            }}
          >
            <XAxis type="number" dataKey="amount" hide />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              interval={0}
              width={isMobile ? 28 : 160}
              tick={renderCategoryTick}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {item.payload.category}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        L.{formatCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="amount" radius={5} shape={renderBarShape} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          {`The category in which you spend the most is
          ${categoryWithHighestValue().categoryName} 
             with L.${formatCurrency(categoryWithHighestValue().highestValue)}`}
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total amount within this year
        </div>
      </CardFooter>
    </Card>
  )
}
