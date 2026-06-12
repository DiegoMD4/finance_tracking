"use client"

import { TrendingUp } from "lucide-react"
import { Pie, PieChart } from "recharts"

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
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils"

export const description = "A simple pie chart"

interface ChartPieSimpleProps {
  data: { name: string; type: string | null; value: number }[]
}

export function ChartPieSimple({ data }: ChartPieSimpleProps) {
  const chartConfig = {
    value: {
      label: "Balance",
    },
    ...data.reduce((acc, account, index) => {
      const key = account.name.toLowerCase().replace(/\s+/g, "-")

      acc[key] = {
        label: account.name,

        color: `var(--chart-${(index % 5) + 1})`,
      }
      return acc
    }, {} as ChartConfig),
  } satisfies ChartConfig

  const formattedChartData = data.map((account) => {
    const key = account.name.toLowerCase().replace(/\s+/g, "-")
    return {
      ...account,
      key,
      fill: `var(--color-${key})`,
    }
  })

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Funds distribution by account</CardTitle>
        {/* <CardDescription></CardDescription> */}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-75"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) =>
                    `${name} - L.${formatCurrency(value as number)}`
                  }
                />
              }
            />
            <Pie data={formattedChartData} dataKey="value" nameKey="name" />
            <ChartLegend
              content={<ChartLegendContent nameKey="key" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      {/*  <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter> */}
    </Card>
  )
}
