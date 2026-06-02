
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
/* import { getBankAccounts } from "@/server/bank_accounts" */

interface InventoryItemsTableProps {
  getBankAccounts: Promise<GetBankAccounts>
}

export function BankAccountsTable({getBankAccounts}: InventoryItemsTableProps) {
  /* const bankAccounts = await getBankAccounts() */
  const bankAccounts = use(getBankAccounts)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bank</TableHead>
          <TableHead>Account Number</TableHead>
          <TableHead>Associated Email</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bankAccounts?.data?.length > 0 ? (
          bankAccounts.data?.map((element: BankAccounts) => (
            <TableRow key={element.id}>
              <TableCell>{element.bankName}</TableCell>
              <TableCell className="font-medium">
                {element.accountNumber}
              </TableCell>
              <TableCell className="font-medium">
                {element.accountEmail}
              </TableCell>
              <TableCell>{element.bankAccountType}</TableCell>
              <TableCell>{element.accountCurrency}</TableCell>
              <TableCell>
                {new Date(element.createdAt).toLocaleDateString("en-CA")}
              </TableCell>
              <TableCell className="text-right">
                <ProductsTableActions bankAccount={element} />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell className="text-center" colSpan={7}>
            <TableCell className="text-center" colSpan={7}>
              There is not accounts created for this user
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
