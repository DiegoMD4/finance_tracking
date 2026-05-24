import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { BankAccounts, GetBankAccounts } from "@/types/bank-accounts.types"
import ProductsTableActions from "./ActionsBankAccountTable"
import { use } from "react"

interface InventoryItemsTableProps {
  getBankAccounts: Promise<GetBankAccounts>
}

export function BankAccountsTable({
  getBankAccounts,
}: InventoryItemsTableProps) {
  const bankAccounts = use(getBankAccounts)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account Number</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bankAccounts.data?.map((element: BankAccounts) => (
          <TableRow key={element.id}>
            <TableCell className="font-medium">
              {element.accountNumber}
            </TableCell>
            <TableCell>{element.bankName}</TableCell>
            <TableCell>
              {new Date(element.createdAt).toLocaleDateString("en-CA")}
            </TableCell>
            <TableCell className="text-right">
              <ProductsTableActions bankAccount={element} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
