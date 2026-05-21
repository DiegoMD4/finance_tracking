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
import { deleteBankAccount } from "@/server/bank_accounts"
import { toast } from "sonner"

interface ProductsTableActionsProps {
  bankAccount: BankAccounts
}

export default function ProductsTableActions({
  bankAccount,
}: ProductsTableActionsProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()

    startTransition(async () => {
      try {
        const res = await deleteBankAccount(bankAccount.id)

        if (res?.success) {
          toast.success("Bank account deleted", {
            position: "bottom-right",
          })
        } else {
          toast.error(res?.message || "Unknown error", {
            position: "bottom-right",
          })
        }
      } catch (error) {
        console.error(error)
        toast.error("An error ocurred, try againg", { position: "bottom-right" })
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
        <DropdownMenuItem onClick={() => toast.info("Not available for now.")}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Not available for now.")}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          {isPending ? `Deleting...` : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
