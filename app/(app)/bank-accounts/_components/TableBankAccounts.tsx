import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { BankAccounts } from "@/types/bank-accounts.types"
import BankAccountTableActions from "./ActionsBankAccountTable"
import { formatCurrency } from "@/lib/utils"


interface InventoryItemsTableProps {
  data: BankAccounts[]
}

export function BankAccountsTable({ data }: InventoryItemsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account Name</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Account Number</TableHead>
          <TableHead>Associated Email</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Opening Balance</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data?.map((element: BankAccounts) => (
            <TableRow key={element.id}>
              <TableCell>{element.accountName}</TableCell>
              <TableCell>{element.bankName}</TableCell>
              <TableCell className="font-medium">
                {element.accountNumber}
              </TableCell>
              <TableCell className="font-medium">
                {element.accountEmail}
              </TableCell>
              <TableCell>{element.bankAccountType}</TableCell>
              <TableCell>{element.accountCurrency}</TableCell>
              <TableCell>{formatCurrency(element.openingBalance)}</TableCell>
              <TableCell>{element.createdAt.toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <BankAccountTableActions bankAccount={element} />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell className="text-center" colSpan={9}>
              There is not accounts created for this user
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
