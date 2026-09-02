import { Button } from "@/components/ui/button"
import { BankAccountsTable } from "./_components/TableBankAccounts"
import Link from "next/link"
import { Plus } from "lucide-react"


import BankAccountsCard from "./_components/CardBanksAccount"
import { getBankAccounts } from "../../server/bank-accounts/queries"
export const dynamic = "force-dynamic"

export default async function BankAccountsPage() {
  const [bankAccounts] = await Promise.all([ getBankAccounts()])

  return (
    <section>
      <header className={"flex flex-row justify-between"}>
        <h1>Your bank accounts</h1>
        <Button asChild>
          <Link href="bank-accounts/new-account" className="gap-x-2">
            <Plus size={16} />
            {"Add bank account"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        <div className="block md:hidden">
          <BankAccountsCard data={bankAccounts.data ?? []} />
        </div>
        <div className="hidden md:block">
          <BankAccountsTable data={bankAccounts.data ?? []} />
        </div>
      </div>
    </section>
  )
}
