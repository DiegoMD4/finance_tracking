import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import { TableCategories } from "./_components/TableCategories"
import Link from "next/link"
import CardCategories from "./_components/CardCategories"
import { getCategories } from "@/server/categories/queries"
export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const [requestHeaders, categories] = await Promise.all([
    headers(),
    getCategories(),
  ])

  const { device } = userAgent({ headers: requestHeaders })
  const isMobile = device.type === "mobile"

  return (
    <section>
      <header
        className={`${isMobile ? "flex flex-col gap-y-5" : "flex flex-row justify-between"}`}
      >
        <h1>Categories</h1>
        <Button asChild>
          <Link href="/categories/new-category" className="gap-x-2">
            <Plus size={16} />
            {!isMobile && "New category"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        {isMobile ? (
          <CardCategories data={categories.data ?? []} />
        ) : (
          <TableCategories data={categories.data ?? []} />
        )}
      </div>
    </section>
  )
}
