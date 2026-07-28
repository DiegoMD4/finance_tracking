import { notFound } from "next/navigation"
import FormCategory from "../_components/FormCategory"
import { getCategoryById } from "@/server/categories/queries"

interface CategoryDetailProps {
  searchParams: Promise<{ id?: string }>
}

export default async function CategoryDetailPage({
  searchParams,
}: CategoryDetailProps) {
  const { id } = await searchParams

  if (!id || isNaN(Number(id))) {
    return notFound()
  }

  const category = await getCategoryById({ id: Number(id) })

  if (!category.success || !category.data) {
    return notFound()
  }

  return (
    <section className="w-full">
      <div className="w-full p-3">
        <FormCategory category={category.data} formType="EDIT" />
      </div>
    </section>
  )
}
