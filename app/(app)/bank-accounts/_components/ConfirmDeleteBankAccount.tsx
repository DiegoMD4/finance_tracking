"use client"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
