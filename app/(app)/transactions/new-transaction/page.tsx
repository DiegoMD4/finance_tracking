import { getSessionUserId } from "@/lib/jwt"
import { getBankAccounts } from "@/server/bank-accounts/queries"
import type { BankAccounts } from "@/types/bank-accounts.types"
import { getCategories } from "@/server/categories/queries"
import { getUserDefaultCurrency } from "@/server/users/queries"
import { NewTransactionClient } from "./_components/NewTransactionClient"

export default async function NewTransactionPage() {
  const userId = await getSessionUserId()

  const [responseBankAccounts, responseCategories, responseCurrency] =
    await Promise.all([
      getBankAccounts(),
      getCategories(),
      userId ? getUserDefaultCurrency(userId) : Promise.resolve(null),
    ])

  const bankAccounts: BankAccounts[] = responseBankAccounts.ok
    ? responseBankAccounts.data
    : []

  const categories = responseCategories.ok ? responseCategories.data : []

  const defaultCurrency =
    responseCurrency?.success && responseCurrency.data
      ? responseCurrency.data
      : "HNL"

  return (
    <section className="w-full">
      <div className="w-full">
        <NewTransactionClient
          bankAccounts={bankAccounts}
          categories={categories}
          defaultCurrency={defaultCurrency}
        />
      </div>
    </section>
  )
}
