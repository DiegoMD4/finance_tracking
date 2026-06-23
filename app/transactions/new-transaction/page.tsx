import { getBankAccounts } from "@/server/bank-accounts/data"
import FormTransaction from "../_components/FormTransaction"
import { getCategories } from "@/server/transactions/data"

export default async function NewTransactionPage() {

  const [responseBankAccounts, responseCategories] = await Promise.all([
    getBankAccounts(),
    getCategories(),
  ])

  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormTransaction
          bankAccounts={responseBankAccounts.data}
          categories={responseCategories.categories}
        />
      </div>
    </section>
  )
}
