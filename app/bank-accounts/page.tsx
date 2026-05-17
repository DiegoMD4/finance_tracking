import { Button } from "@/components/ui/button"
import { InventoryItemsTable } from "./_components/products-table"
import Link from "next/link"

export default function Products() {
  return (
    <section>
      <header className="flex flex-row justify-between">
        <h1>Inventario de productos</h1>
        <Button asChild>
          <Link href="bank-accounts/new">Add bank account</Link>
        </Button>
      </header>
      <div className="mt-5">
        <InventoryItemsTable />
      </div>
    </section>
  )
}
