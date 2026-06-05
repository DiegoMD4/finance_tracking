import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { TransactionListItem } from "@/types/transactions.types"
import TransactionsActions from "./TransactionsActions"
import PaginationTable from "@/components/pagination"

interface TransactionsTableProps {
  data: TransactionListItem[]
}

export function TransactionsTable({ data }: TransactionsTableProps) {
  return (
    <>
      {" "}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="capitalize">
                  {transaction.transactionType}
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell>{transaction.source || "-"}</TableCell>
                <TableCell>
                  {transaction.transactionDescription || "-"}
                </TableCell>
                <TableCell>
                  {transaction.accountName || "Unnamed account"}
                </TableCell>
                <TableCell>{transaction.bankName || "Unknown bank"}</TableCell>
                <TableCell>
                  {transaction.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <TransactionsActions transactionId={transaction.id} />
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
    </>
  )
}
