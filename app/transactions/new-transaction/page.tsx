import { getBankAccounts } from "@/app/bank-accounts/server/data"
import FormTransaction from "../_components/FormTransaction"

export default async function NewTransactionPage() {
  const response = await getBankAccounts()

  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormTransaction bankAccounts={response.data} />
      </div>
    </section>
  )
}
