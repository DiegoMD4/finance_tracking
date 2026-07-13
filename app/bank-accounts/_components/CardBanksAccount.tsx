"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from "@/components/ui/collapsible"
import { formatCurrency } from "@/lib/utils"

import { BankAccounts } from "@/types/bank-accounts.types"
import { ChevronDownIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { deleteBankAccount } from "../../../server/bank-accounts/actions"

interface BankAccountsCardProps {
  data: BankAccounts[]
}

export default function BankAccountsCard({ data }: BankAccountsCardProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault()

    startTransition(async () => {
      try {
        const res = await deleteBankAccount(id)

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
    <section className="flex flex-col gap-y-4 px-2">
      {data.map((element) => (
        <Card className="mx-auto w-full max-w-sm" key={element.id} size="sm">
          <CardContent className="px-1 py-0">
            <Collapsible className="rounded-md transition-colors data-[state=open]:bg-muted/40">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="group h-auto w-full justify-start px-4 py-3 text-left"
                >
                  <div className="flex max-w-[85%] flex-row items-start gap-x-4">
                    <span className="w-full truncate font-mono font-bold">
                      {element.accountName}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {element.accountNumber}
                    </span>
                  </div>
                  <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="flex flex-col gap-y-4 p-4 pt-2 font-mono text-xs">
                <ul className="space-y-1.5 border-t border-muted/50 pt-3 text-muted-foreground">
                  <li className="flex justify-between">
                    <span>Bank Name:</span>
                    <span className="font-medium text-foreground">
                      {element.bankName}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Currency:</span>
                    <span className="font-medium text-foreground">
                      {element.accountCurrency}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Account Type:</span>
                    <span className="font-medium text-foreground capitalize">
                      {element.bankAccountType}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Opening Balance:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(element.openingBalance)}
                    </span>
                  </li>
                  {element.accountEmail && (
                    <li className="flex flex-col gap-y-0.5 pt-1">
                      <span>Email:</span>
                      <span className="break-all text-foreground">
                        {element.accountEmail}
                      </span>
                    </li>
                  )}
                  <li className="flex justify-between pt-2 text-[10px] opacity-60">
                    <span>Created:</span>
                    <span>{element.createdAt.toLocaleDateString()}</span>
                  </li>
                </ul>

                <div className="flex w-full flex-row justify-end gap-3 pt-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => router.push(`/bank-accounts/${element.id}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={(e) => {
                      handleDelete(e, element.id)
                    }}
                  >
                    {isPending ? "Deleting" : "Delete"}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
