import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatCurrency } from "@/lib/utils"
import { TransactionListItem } from "@/types/transactions.types"
import TransactionsActions from "./TransactionsActions"

interface TransactionsTableProps {
  data: TransactionListItem[]
}

export function TransactionsTable({ data }: TransactionsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>

          <TableHead>Category</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{transaction.transactionDescription || "-"}</TableCell>

              <TableCell>{transaction.categoryName || "-"}</TableCell>

              <TableCell>
                {transaction.accountName || "Unnamed account"}
              </TableCell>
              <TableCell>{transaction.bankName || "Unknown bank"}</TableCell>
              <TableCell
                className={cn(
                  "capitalize",
                  transaction.transactionType.toLowerCase() === "expense"
                    ? "text-red-500"
                    : "text-emerald-500"
                )}
              >
                {transaction.transactionType}
              </TableCell>
              <TableCell className="font-medium">
                {`L. ${formatCurrency(transaction.amount)}`}
              </TableCell>
              <TableCell>
                {transaction.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <TransactionsActions transaction={transaction} />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell className="text-center" colSpan={8}>
              There are no transactions registered for this user.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
