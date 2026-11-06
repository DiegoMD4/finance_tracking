"use client"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { deleteTransaction } from "@/server/transactions/actions"

interface ConfirmDeleteTransactionProps {
  transactionId: number
  transactionDescription: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ConfirmDeleteTransaction({
  transactionId,
  transactionDescription,
  open,
  onOpenChange,
}: ConfirmDeleteTransactionProps) {
  const router = useRouter()

  const itemName = transactionDescription ?? "transaction"

  const handleDelete = async () => {
    try {
      const response = await deleteTransaction(transactionId)

      if (response.success) {
        toast.success("Transaction deleted")
        router.push("/transactions")
      } else {
        toast.error(response.message || "Unknown error")
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred while deleting transaction")
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Are you sure you want to delete this ${itemName}?`}
      description="This can't be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={handleDelete}
    />
  )
}
