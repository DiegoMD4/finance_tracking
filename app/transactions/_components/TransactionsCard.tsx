import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { TransactionListItem } from "@/types/transactions.types"
import { ChevronDownIcon } from "lucide-react"
import TransactionsActions from "./TransactionsActions"

interface TransactionsCardProps {
  data: TransactionListItem[]
}

export default function TransactionsCard({ data }: TransactionsCardProps) {
  if (data.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        There are no transactions registered yet.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-y-4 px-2">
      {data.map((transaction) => (
        <Card
          className="mx-auto w-full max-w-sm"
          key={transaction.id}
          size="sm"
        >
          <CardContent className="px-1 py-0">
            <Collapsible className="rounded-md transition-colors data-[state=open]:bg-muted/40">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="group h-auto w-full justify-start px-4 py-3 text-left"
                >
                  <div className="flex max-w-[85%] flex-row items-start gap-x-4">
                    <span className="w-full truncate font-mono font-bold capitalize">
                      {transaction.transactionType}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="flex flex-col gap-y-4 p-4 pt-2 font-mono text-xs">
                <ul className="space-y-1.5 border-t border-muted/50 pt-3 text-muted-foreground">
                  <li className="flex justify-between">
                    <span>Amount:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium text-foreground capitalize">
                      {transaction.transactionType}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Account:</span>
                    <span className="font-medium text-foreground">
                      {transaction.accountName || "Unnamed account"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Bank:</span>
                    <span className="font-medium text-foreground">
                      {transaction.bankName || "Unknown bank"}
                    </span>
                  </li>
                  {transaction.source && (
                    <li className="flex flex-col gap-y-0.5 pt-1">
                      <span>Source:</span>
                      <span className="break-all text-foreground">
                        {transaction.source}
                      </span>
                    </li>
                  )}
                  {transaction.transactionDescription && (
                    <li className="flex flex-col gap-y-0.5 pt-1">
                      <span>Description:</span>
                      <span className="break-all text-foreground">
                        {transaction.transactionDescription}
                      </span>
                    </li>
                  )}
                  <li className="flex justify-between pt-2 text-[10px] opacity-60">
                    <span>Created:</span>
                    <span>{transaction.createdAt.toLocaleDateString()}</span>
                  </li>
                </ul>

                <TransactionsActions
                  transactionId={transaction.id}
                  variant="buttons"
                />
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
