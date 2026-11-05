import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <section className="fc-enter flex flex-1 flex-col gap-4 p-6 max-sm:p-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        {/* Incomes vs Expenses card */}
        <div className="flex flex-col gap-3 min-h-[320px]">
          <div className="h-3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
          <div className="flex-1 bg-muted rounded animate-pulse" />
        </div>

        {/* Net balance + daily average cards */}
        <section className="flex min-h-0 flex-col gap-y-4">
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex flex-col gap-y-2">
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="flex flex-row gap-x-4">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Funds distribution pie chart */}
        <div className="flex flex-col gap-3 min-h-[320px]">
          <div className="h-3 bg-muted rounded animate-pulse" />
          <div className="aspect-square max-h-75 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Expenses by category chart */}
      <div className="flex flex-col gap-3 min-h-[320px]">
        <div className="h-3 bg-muted rounded animate-pulse" />
        <div className="h-full bg-muted rounded animate-pulse" />
      </div>
    </section>
  )
}
