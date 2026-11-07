"use client"

import { AlertDialogDestructive } from "@/components/ui/alert-dialog-destructive"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { deleteBankAccount } from "../../../../server/bank-accounts/actions"

interface ConfirmDeleteBankAccountProps {
  bankAccountId: number
  bankAccountName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ConfirmDeleteBankAccount({
  bankAccountId,
  bankAccountName,
  open,
  onOpenChange,
}: ConfirmDeleteBankAccountProps) {
  const router = useRouter()

  const handleDelete = async () => {
    try {
      const res = await deleteBankAccount(bankAccountId)

      if (res?.success) {
        toast.success("Bank account deleted")
        router.push("/bank-accounts")
      } else {
        toast.error(res?.message || "Unknown error")
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred, try again")
    }
  }

  const itemName = bankAccountName ?? "bank account"

  return (
    <AlertDialogDestructive
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${itemName}?`}
      description="This will permanently delete this bank account. This can't be undone."
      cancelLabel="Cancel"
      actionLabel="Delete"
      onAction={handleDelete}
    />
  )
}
