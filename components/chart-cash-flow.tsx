"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  computeCashFlow,
  type CashFlowGranularity,
  type CashFlowTransaction,
} from "@/lib/cash-flow"
import { formatCurrency } from "@/lib/utils"

interface CashFlowAccountData {
  accountId: number
  accountName: string | null
  bankName: string
  openingBalance: string
  transactions: CashFlowTransaction[]
}

interface ChartCashFlowProps {
  data: CashFlowAccountData[]
}

const chartConfig = {
  balance: {
    label: "Balance",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const GRANULARITY_OPTIONS: { value: CashFlowGranularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
]

interface CashFlowDotProps {
  cx?: number
  cy?: number
  payload?: { isNegative: boolean }
}

function CashFlowDot({ cx, cy, payload }: CashFlowDotProps) {
  if (cx === undefined || cy === undefined) {
    return null
  }

  const color = payload?.isNegative ? "#ef4444" : "var(--color-balance)"

  return <circle cx={cx} cy={cy} r={3} fill={color} stroke={color} />
}

export function ChartCashFlow({ data }: ChartCashFlowProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<
    number | undefined
  >(data[0]?.accountId)
  const [granularity, setGranularity] = useState<CashFlowGranularity>("month")

  const selectedAccount = data.find(
    (account) => account.accountId === selectedAccountId
  )

  const points = useMemo(() => {
    if (!selectedAccount) {
      return []
    }

    return computeCashFlow(
      Number(selectedAccount.openingBalance),
      selectedAccount.transactions,
      granularity
    )
  }, [selectedAccount, granularity])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash flow trend</CardTitle>
          <CardDescription>
            You need at least one bank account to see its cash flow trend.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Cash flow trend</CardTitle>
          <CardDescription>
            Running balance over time for the selected account
          </CardDescription>
        </div>
        <div className="flex flex-row gap-2">
          <Select
            value={selectedAccountId?.toString()}
            onValueChange={(value) => setSelectedAccountId(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {data.map((account) => (
                  <SelectItem
                    key={account.accountId}
                    value={account.accountId.toString()}
                  >
                    {account.accountName || "Unnamed account"} -{" "}
                    {account.bankName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={granularity}
            onValueChange={(value) =>
              setGranularity(value as CashFlowGranularity)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Granularity" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {GRANULARITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={points} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="periodLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `L. ${formatCurrency(value as number)}`
                  }
                />
              }
            />
            <Line
              dataKey="balance"
              type="monotone"
              stroke="var(--color-balance)"
              strokeWidth={2}
              dot={<CashFlowDot />}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
