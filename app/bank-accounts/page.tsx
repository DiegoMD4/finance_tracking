import { Button } from "@/components/ui/button"
import { InventoryItemsTable } from "./_components/ActionsBankAccountsTable"
import Link from "next/link"
import { Suspense } from "react"
import { getBankAccounts } from "@/server/bank_accounts"
import { SkeletonTable } from "./_components/SkeletonTable"

export default function Products() {
  return (
    <section>
      <header className="flex flex-row justify-between">
        <h1>Your bank accounts</h1>
        <Button asChild>
          <Link href="bank-accounts/add-new">Add bank account</Link>
        </Button>
      </header>
      <div className="mt-5">
        <Suspense fallback={<SkeletonTable />}>
          <InventoryItemsTable getBankAccounts={getBankAccounts()} />
        </Suspense>
      </div>
    </section>
  )
}
