"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteTransaction } from "@/app/transactions/server/server"
import { MoreHorizontalIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

interface TransactionsActionsProps {
  transactionId: number
  variant?: "menu" | "buttons"
}

export default function TransactionsActions({
  transactionId,
  variant = "menu",
}: TransactionsActionsProps) {
  const [isPending, startTransition] = useTransition()
/*   const router = useRouter() */

  const handleEdit = () => {
    /* router.push(`/transactions/edit?transactionId=${transactionId}`) */
  }

  const handleDelete = (event?: React.MouseEvent) => {
    event?.preventDefault()

    startTransition(async () => {
      try {
        const response = await deleteTransaction(transactionId)

        if (response.success) {
          toast.success("Transaction deleted")
          return
        }

        toast.error(response.message || "Unknown error")
      } catch (error) {
        console.error(error)
        toast.error("An error occurred while deleting transaction")
      }
    })
  }

  if (variant === "buttons") {
    return (
      <div className="flex w-full flex-row justify-end gap-3 pt-2">
       {/*  <Button size="xs" variant="outline" onClick={handleEdit}>
          Edit
        </Button> */}
        <Button
          size="xs"
          variant="destructive"
          onClick={(event) => handleDelete(event)}
          disabled={isPending}
        >
          {isPending ? "Deleting" : "Delete"}
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontalIcon />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
       {/*  <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator /> */}
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => handleDelete(event)}
          disabled={isPending}
        >
          {isPending ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
