
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBankAccounts } from "@/server/bank_accounts"
import { BankAccounts } from "@/types/bank-accounts.types"
import ProductsTableActions from "./products-table-actions"

export async function InventoryItemsTable() {
  const bankAccounst = await getBankAccounts()

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
        {bankAccounst.data?.map((element: BankAccounts) => (
          <TableRow key={element.id}>
            <TableCell className="font-medium">
              {element.accountNumber}
            </TableCell>
            <TableCell>{element.bankName}</TableCell>
            <TableCell>
              {new Date(element.createdAt).toLocaleDateString("en-CA")}
            </TableCell>
            <TableCell className="text-right">
              <ProductsTableActions bankAccount={element}/>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
