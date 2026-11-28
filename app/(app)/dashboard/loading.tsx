export default function DashboardLoading() {
  return (
    <section className="fc-enter flex flex-1 flex-col gap-4 p-6 max-sm:p-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        {/* Incomes vs Expenses card */}
        <div className="flex min-h-[320px] flex-col gap-3">
          <div className="h-3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="flex-1 animate-pulse rounded bg-muted" />
        </div>

        {/* Net balance + daily average cards */}
        <section className="flex min-h-0 flex-col gap-y-4">
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-col gap-y-2">
              <div className="h-6 animate-pulse rounded bg-muted" />
              <div className="flex flex-row gap-x-4">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        </section>

        {/* Funds distribution pie chart */}
        <div className="flex min-h-[320px] flex-col gap-3">
          <div className="h-3 animate-pulse rounded bg-muted" />
          <div className="aspect-square max-h-75 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Monthly metrics row */}
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex min-h-[110px] flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-col gap-y-2">
              <div className="h-8 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Expenses by category chart */}
      <div className="flex min-h-[320px] flex-col gap-3">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-full animate-pulse rounded bg-muted" />
      </div>
    </section>
  )
}
