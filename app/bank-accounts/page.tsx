import { Button } from "@/components/ui/button"
import { BankAccountsTable } from "./_components/TableBankAccounts"
import Link from "next/link"
import { Suspense } from "react"
import { getBankAccounts } from "@/server/bank_accounts"
import { SkeletonTable } from "./_components/SkeletonTable"
import { Plus } from "lucide-react"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import BankAccountsCard from "./_components/CardBanksAccount"
import { SkeletonCard } from "./_components/SkeletonCard"
export const dynamic = "force-dynamic"

export default async function BankAccountsPage() {
  const requestHeaders = await headers()
  const { device } = userAgent({ headers: requestHeaders })
  const isMobile = device.type === "mobile"
  const getUserBankAccounts = getBankAccounts()
  return (
    <section>
      <header className={`${isMobile ? "flex flex-col gap-y-5" : "flex flex-row justify-between"}`}>
        <h1>Your bank accounts</h1>
        <Button asChild>
          <Link href="bank-accounts/add-new" className="gap-x-2">
            <Plus size={16} />
            Add bank account
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        {isMobile ? (
          <Suspense fallback={<SkeletonCard />}>
            <BankAccountsCard getBankAccounts={getUserBankAccounts} />
          </Suspense>
        ) : (
          <Suspense fallback={<SkeletonTable />}>
            <BankAccountsTable getBankAccounts={getUserBankAccounts} />
          </Suspense>
        )}
      </div>
    </section>
  )
}
