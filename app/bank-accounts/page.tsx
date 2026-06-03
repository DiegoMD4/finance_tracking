import { Button } from "@/components/ui/button"
import { BankAccountsTable } from "./_components/TableBankAccounts"
import Link from "next/link"
import { Suspense } from "react"
import { getBankAccounts } from "@/server/bank_accounts"
import { SkeletonTable } from "./_components/SkeletonTable"
import { Plus } from "lucide-react"
export const dynamic = "force-dynamic"

export default async function BankAccountsPage() {
  const getUserBankAccounts = getBankAccounts()
  return (
    <section>
      <header className="flex flex-row justify-between">
        <h1>Your bank accounts</h1>
        <Button asChild>
          <Link href="bank-accounts/add-new">
            <Plus size={16} />
            Add bank account
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        <Suspense fallback={<SkeletonTable />}>
          <BankAccountsTable getBankAccounts={getUserBankAccounts} />
        </Suspense>
      </div>
    </section>
  )
}
