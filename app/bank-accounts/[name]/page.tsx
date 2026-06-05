import { notFound } from "next/navigation"
import FormBankAccounts from "../_components/FormBankAccounts"
import { getBankAccountById } from "../../../server/bank-accounts/data"

interface EditBankAccountProps {
  params: Promise<{ name: string }>
  searchParams: Promise<{ id?: string }>
}

export default async function EditBankAccount({
  params,
  searchParams,
}: EditBankAccountProps) {
  const { name } = await params
  const { id } = await searchParams

  if (!id || isNaN(Number(id))) {
    return notFound()
  }

  const bankAccount = await getBankAccountById({ id: Number(id) })

  if (!bankAccount.success || !bankAccount.data) {
    return notFound()
  }

  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormBankAccounts
          bankAccount={bankAccount.data}
          formType="EDIT"
          name={name}
        />
      </div>
    </section>
  )
}
