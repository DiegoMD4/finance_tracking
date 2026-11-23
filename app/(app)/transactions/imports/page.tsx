import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getRecentImportBatches } from "@/server/transactions/queries"
import { ImportBatchesList } from "./_components/ImportBatchesList"

export const dynamic = "force-dynamic"

export default async function ImportHistoryPage() {
  const result = await getRecentImportBatches(20)
  const batches = result.ok ? result.data : []

  return (
    <section>
      <header className="flex flex-row items-center justify-between gap-4">
        <h1>Import history</h1>
        <Button asChild variant="outline">
          <Link href="/transactions" className="gap-x-2">
            <ArrowLeft size={16} />
            Back to transactions
          </Link>
        </Button>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Every bulk upload keeps its own batch, so you can undo one import without
        touching the transactions added by another.
      </p>

      {!result.ok && (
        <p className="mt-4 text-sm text-destructive">{result.error.message}</p>
      )}

      <div className="mt-8">
        <ImportBatchesList batches={batches} />
      </div>
    </section>
  )
}
