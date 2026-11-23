"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Undo2 } from "lucide-react"

import { AlertDialogDestructive } from "@/components/ui/alert-dialog-destructive"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { undoImportBatch } from "@/server/transactions/actions"
import type { ImportBatchSummary } from "@/types/transactions.types"

const formatDateTime = (value: Date): string => {
  const date = new Date(value)
  const pad = (input: number) => String(input).padStart(2, "0")

  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`
}

export function ImportBatchesList({
  batches,
}: {
  batches: ImportBatchSummary[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<ImportBatchSummary | null>(null)

  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No bulk imports yet. Upload a bank statement from the transactions page
        and it will show up here.
      </p>
    )
  }

  const handleUndo = async () => {
    if (!selected) return

    try {
      const response = await undoImportBatch(selected.id)

      if (response.success) {
        toast.success(response.message)
        router.refresh()
      } else {
        toast.error(response.message)
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred while undoing the import")
    }
  }

  const fileLabel = selected?.fileName ?? "this file"
  const description = selected
    ? `This deletes ${selected.savedCount} transaction${
        selected.savedCount === 1 ? "" : "s"
      } created by "${fileLabel}" on ${formatDateTime(
        selected.createdAt
      )}, including any changes you made to them. This can't be undone.`
    : ""

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imported at</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Skipped</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const undone = batch.undoneAt !== null

              return (
                <TableRow key={batch.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateTime(batch.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">
                    {batch.fileName ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {batch.accountName ?? `Account ${batch.accountId}`}
                  </TableCell>
                  <TableCell className="text-xs">{batch.rowCount}</TableCell>
                  <TableCell className="text-xs">{batch.savedCount}</TableCell>
                  <TableCell className="text-xs">
                    {batch.skippedCount}
                  </TableCell>
                  <TableCell className="text-xs">{batch.failedCount}</TableCell>
                  <TableCell className="text-xs">
                    {undone ? (
                      <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                        Undone
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-x-1"
                      disabled={undone || batch.savedCount === 0}
                      onClick={() => setSelected(batch)}
                    >
                      <Undo2 size={14} />
                      Undo
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialogDestructive
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title="Undo this import?"
        description={description}
        cancelLabel="Cancel"
        actionLabel="Undo import"
        actionLoadingLabel="Undoing..."
        onAction={handleUndo}
      />
    </>
  )
}
