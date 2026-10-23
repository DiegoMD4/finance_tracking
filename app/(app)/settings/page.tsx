import { requireUserId } from "@/lib/jwt"
import { getUserDefaultCurrency } from "@/server/users/queries"
import { redirect } from "next/navigation"
import { FormSettings } from "./_components/FormSettings"

export default async function SettingsPage() {
  const userId = await requireUserId()

  const currencyResult = await getUserDefaultCurrency(userId)
  const currentCurrency = currencyResult.data ?? "HNL"

  return (
    <section>
      <header className="flex flex-row justify-between items-start">
        <h1>Settings</h1>
      </header>

      <div className="mt-8">
        <FormSettings currentCurrency={currentCurrency} />
      </div>
    </section>
  )
}
