import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TransactionsTable } from "./_components/TransactionsTable"
import Link from "next/link"
import TransactionsCard from "./_components/TransactionsCard"
import { getTransactionsPaginated } from "../../server/transactions/queries"
import PaginationTable from "@/components/pagination"
export const revalidate = 60 

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

  const transactions = await getTransactionsPaginated(
    parsedPage,
    parsedPageSize
  )

  const { items, hasMore } = transactions.ok
    ? transactions.data
    : { items: [], hasMore: true }

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
          <TransactionsCard data={items} />
        </div>

        <div className="hidden md:block">
          <TransactionsTable data={items} />
        </div>

        <div className="mt-4">
          <PaginationTable
            page={parsedPage}
            pageSize={parsedPageSize}
            hasMore={hasMore}
            route="/transactions"
          />
        </div>
      </div>
    </section>
  )
}
