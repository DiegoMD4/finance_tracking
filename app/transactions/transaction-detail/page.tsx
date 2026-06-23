import { getBankAccounts } from "@/server/bank-accounts/data"
import FormTransaction from "../_components/FormTransaction"
import { getCategories, getTransactionsById } from "@/server/transactions/data"
import { notFound } from "next/navigation"

interface TransactionDetailProps {
  searchParams: Promise<{ id?: string }>
}

export default async function TransactionDetailPage({
  searchParams,
}: TransactionDetailProps) {
  const { id } = await searchParams

  if (!id || isNaN(Number(id))) {
    return notFound()
  }

  const [responseBankAccounts, responseCategories, responseTransaction] =
    await Promise.all([
      getBankAccounts(),
      getCategories(),
      getTransactionsById({ id: Number(id) }),
    ])

  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormTransaction
          formType="VIEW"
          bankAccounts={responseBankAccounts.data}
          categories={responseCategories.categories}
          transaction={responseTransaction.data}
        />
      </div>
    </section>
  )
}
