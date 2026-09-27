"use client"
import { MoreHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import { Category } from "@/types/categories.types"
import { useTransition } from "react"

import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { deleteCategory } from "@/server/categories/actions"

interface ActionsCategoryTableProps {
  category: Category
  variant?: "menu" | "buttons"
}

export default function ActionsCategoryTable({
  category,
  variant = "menu",
}: ActionsCategoryTableProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isDefaultCategory = category.name === DEFAULT_CATEGORY_NAME

  const handleEdit = () => {
    router.push(`/categories/category-detail?id=${category.categoryId}`)
  }

  const handleDelete = (e?: React.MouseEvent) => {
    e?.preventDefault()

    startTransition(async () => {
      try {
        const res = await deleteCategory(category.categoryId)

        if (res?.success) {
          toast.success("Category deleted")
        } else {
          toast.error(res?.message || "Unknown error")
        }
      } catch (error) {
        console.error(error)
        toast.error("An error ocurred, try againg")
      }
    })
  }

  if (variant === "buttons") {
    return (
      <div className="flex w-full flex-row justify-end gap-3 pt-2">
        <Button size="xs" variant="outline" onClick={handleEdit}>
          Edit
        </Button>
        <Button
          size="xs"
          variant="destructive"
          onClick={(e) => handleDelete(e)}
          disabled={isPending || isDefaultCategory}
        >
          {isPending
            ? "Deleting"
            : isDefaultCategory
              ? "Default category"
              : "Delete"}
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontalIcon />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => handleDelete(e)}
          disabled={isPending || isDefaultCategory}
        >
          {isPending
            ? "Deleting..."
            : isDefaultCategory
              ? "Default category"
              : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
