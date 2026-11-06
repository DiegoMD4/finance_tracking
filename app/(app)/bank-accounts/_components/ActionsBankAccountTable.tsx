"use client"
import React from "react"
import { MoreHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BankAccounts } from "@/types/bank-accounts.types"
import { useTransition } from "react"

import { toast } from "sonner"
import { useRouter } from "next/navigation"
import ConfirmDeleteBankAccount from "./ConfirmDeleteBankAccount"

interface ProductsTableActionsProps {
  bankAccount: BankAccounts
}

export default function BankAccountTableActions({
  bankAccount,
}: ProductsTableActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <ConfirmDeleteBankAccount
        bankAccountId={bankAccount.id}
        bankAccountName={bankAccount.accountName ?? null}
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
          <DropdownMenuItem
            onClick={() =>
              router.push(
                `/bank-accounts/${bankAccount.accountName}?id=${bankAccount.id}`
              )
            }
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={handleOpenDeleteDialog}
            disabled={isPending}
          >
            {isPending ? `Deleting...` : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
