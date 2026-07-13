import { Button } from "@/components/ui/button"
import { BankAccountsTable } from "./_components/TableBankAccounts"
import Link from "next/link"
import { Plus } from "lucide-react"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import BankAccountsCard from "./_components/CardBanksAccount"
import { getBankAccounts } from "../../server/bank-accounts/queries"
export const dynamic = "force-dynamic"

export default async function BankAccountsPage() {
  const [requestHeaders, bankAccounts] = await Promise.all([
    headers(),
    getBankAccounts(),
  ])

  const { device } = userAgent({ headers: requestHeaders })
  const isMobile = /* device.type === "mobile" */ false

  return (
    <section>
      <header
        className={`${isMobile ? "flex flex-col gap-y-5" : "flex flex-row justify-between"}`}
      >
        <h1>Your bank accounts</h1>
        <Button asChild>
          <Link href="bank-accounts/new-account" className="gap-x-2">
            <Plus size={16} />
            {!isMobile && "Add bank account"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        {isMobile ? (
          <BankAccountsCard data={bankAccounts.data ?? []} />
        ) : (
          <BankAccountsTable data={bankAccounts.data ?? []} />
        )}
      </div>
    </section>
  )
}
