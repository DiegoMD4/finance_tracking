"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteTransaction } from "@/server/transactions/actions"
import { TransactionListItem } from "@/types/transactions.types"
import { MoreHorizontalIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import ConfirmDeleteTransaction from "./ConfirmDeleteTransaction"

interface TransactionsActionsProps {
  transaction: TransactionListItem
  variant?: "menu" | "buttons"
}

export default function TransactionsActions({
  transaction,
  variant = "menu",
}: TransactionsActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const handleView = () => {
    router.push(`/transactions/transaction-detail?id=${transaction.id}`)
  }

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true)
  }

  const itemName = transaction.transactionDescription ?? "transaction"

  if (variant === "buttons") {
    return (
      <>
        <ConfirmDeleteTransaction
          transactionId={transaction.id}
          transactionDescription={transaction.transactionDescription}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open)
            return open
          }}
        />
        <div className="flex w-full flex-row justify-end gap-3 pt-2">
           <Button size="xs" variant="outline" onClick={handleView}>
            View details
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleOpenDeleteDialog()
            }}
            disabled={isPending}
          >
            {isPending ? "Deleting" : "Delete"}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <ConfirmDeleteTransaction
        transactionId={transaction.id}
        transactionDescription={transaction.transactionDescription}
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
           <DropdownMenuItem onClick={handleView}>View details</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleOpenDeleteDialog()
            }}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
