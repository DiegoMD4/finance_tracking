import { Button } from "@/components/ui/button"
import { BankAccountsTable } from "./_components/TableBankAccounts"
import Link from "next/link"
import { Plus } from "lucide-react"

import BankAccountsCard from "./_components/CardBanksAccount"
import { getBankAccountsPaginated } from "../../server/bank-accounts/queries"
import PaginationTable from "@/components/pagination"
export const revalidate = 60

interface BankAccountsPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}

export default async function BankAccountsPage({
  searchParams,
}: BankAccountsPageProps) {
  const { page, pageSize } = await searchParams

  const parsedPage = !page || isNaN(Number(page)) ? 1 : Number(page)
  const parsedPageSize =
    !pageSize || isNaN(Number(pageSize)) ? 5 : Number(pageSize)

  const bankAccounts = await getBankAccountsPaginated(
    parsedPage,
    parsedPageSize
  )

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

        <div className="mt-4">
          <PaginationTable
            page={parsedPage}
            pageSize={parsedPageSize}
            hasMore={bankAccounts.hasMore ?? true}
            route="/bank-accounts"
          />
        </div>
      </div>
    </section>
  )
}
