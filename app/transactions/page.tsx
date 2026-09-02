import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TransactionsTable } from "./_components/TransactionsTable"
import Link from "next/link"
import TransactionsCard from "./_components/TransactionsCard"
import { getTransactionsPaginated } from "../../server/transactions/queries"
import PaginationTable from "@/components/pagination"
export const dynamic = "force-dynamic"

interface TransactionPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}

export default async function TransactionsPage({
  searchParams,
}: TransactionPageProps) {
  const { page, pageSize } = await searchParams

  const parsedPage = !page || isNaN(Number(page)) ? 1 : Number(page)
  const parsedPageSize =
    !pageSize || isNaN(Number(pageSize)) ? 5 : Number(pageSize)

  const [transactions] = await Promise.all([
    getTransactionsPaginated(parsedPage, parsedPageSize),
  ])

  return (
    <section>
      <header className="flex flex-row justify-between">
        <h1>Transactions</h1>
        <Button asChild>
          <Link href="/transactions/new-transaction" className="gap-x-2">
            <Plus size={16} />
            {"New transaction"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        <div className="block md:hidden">
          <TransactionsCard data={transactions.data ?? []} />
        </div>

        <div className="hidden md:block">
          <TransactionsTable data={transactions.data ?? []} />
        </div>

        <div className="mt-4">
          <PaginationTable
            page={Number(page)}
            pageSize={Number(pageSize)}
            hasMore={transactions.hasMore ?? true}
            route="/transactions"
          />
        </div>
      </div>
    </section>
  )
}
