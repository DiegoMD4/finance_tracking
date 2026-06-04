"use client"
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
import { deleteBankAccount } from "../server/server"

interface ProductsTableActionsProps {
  bankAccount: BankAccounts
}

export default function ProductsTableActions({
  bankAccount,
}: ProductsTableActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()

    startTransition(async () => {
      try {
        const res = await deleteBankAccount(bankAccount.id)

        if (res?.success) {
          toast.success("Bank account deleted")
        } else {
          toast.error(res?.message || "Unknown error")
        }
      } catch (error) {
        console.error(error)
        toast.error("An error ocurred, try againg")
      }
    })
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
        <DropdownMenuItem
          onClick={() => router.push(`/bank-accounts/${bankAccount.accountName}?id=${bankAccount.id}`)}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? `Deleting...` : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
