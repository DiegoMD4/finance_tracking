import { createBankAccount } from "@/server/bank_accounts";
import { Button } from "@/components/ui/button"

export default async function NewInventoryItem() {
  
  return (
    <section>
      <header>Nuevo producto</header>
      <form action={createBankAccount}>
        <Button>Create bank account</Button>
      </form>
    </section>
  )
}
