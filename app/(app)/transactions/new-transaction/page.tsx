import { getBankAccounts } from "@/server/bank-accounts/queries"
import type { BankAccounts } from "@/types/bank-accounts.types"
import { getCategories } from "@/server/categories/queries"
import { NewTransactionClient } from "./_components/NewTransactionClient"

export default async function NewTransactionPage() {
  const [responseBankAccounts, responseCategories] = await Promise.all([
    getBankAccounts(),
    getCategories(),
  ])

  const bankAccounts: BankAccounts[] = responseBankAccounts.ok
    ? responseBankAccounts.data
    : []

  const categories = responseCategories.ok ? responseCategories.data : []

  return (
    <section className="w-full">
      <div className="w-full">
        <NewTransactionClient
          bankAccounts={bankAccounts}
          categories={categories}
        />
      </div>
    </section>
  )
}
