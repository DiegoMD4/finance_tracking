
import FormBankAccounts from "../_components/FormBankAccounts"
import { getBankAccountById } from "../server/data"

interface EditBankAccountProps {
  params: Promise<{ id: string }>
}

export default async function EditBankAccount({
  params,
}: EditBankAccountProps) {
  const { id } = await params
  const bankAccount = await getBankAccountById({ id: Number(id) })
  
  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormBankAccounts bankAccount={bankAccount.data} formType="EDIT"/>
      </div>
    </section>
  )
}
