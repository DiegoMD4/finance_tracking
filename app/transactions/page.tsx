import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import { TransactionsTable } from "./_components/TransactionsTable"
import Link from "next/link"
import TransactionsCard from "./_components/TransactionsCard"
import { getTransactions } from "../../server/transactions/data"
export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const [requestHeaders, transactions] = await Promise.all([
    headers(),
    getTransactions(),
  ])

  const { device } = userAgent({ headers: requestHeaders })
  const isMobile = device.type === "mobile"

  return (
    <section>
      <header
        className={`${isMobile ? "flex flex-col gap-y-5" : "flex flex-row justify-between"}`}
      >
        <h1>Transactions</h1>
        <Button asChild>
          <Link href="/transactions/new-transaction" className="gap-x-2">
            <Plus size={16} />
            {!isMobile && "New transaction"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        {isMobile ? (
          <TransactionsCard data={transactions.data ?? []} />
        ) : (
          <TransactionsTable data={transactions.data ?? []} />
        )}
      </div>
    </section>
  )
}
