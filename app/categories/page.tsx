import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TableCategories } from "./_components/TableCategories"
import Link from "next/link"
import CardCategories from "./_components/CardCategories"
import { getCategories } from "@/server/categories/queries"
export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const [categories] = await Promise.all([getCategories()])

  return (
    <section>
      <header className={"flex flex-row justify-between"}>
        <h1>Categories</h1>
        <Button asChild>
          <Link href="/categories/new-category" className="gap-x-2">
            <Plus size={16} />
            {"New category"}
          </Link>
        </Button>
      </header>
      <div className="mt-8">
        <div className="block md:hidden">
          <CardCategories data={categories.data ?? []} />
        </div>

        <div className="hidden md:block">
          <TableCategories data={categories.data ?? []} />
        </div>
      </div>
    </section>
  )
}
