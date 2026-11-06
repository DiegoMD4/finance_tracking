"use client"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { deleteCategory } from "@/server/categories/actions"

interface ConfirmDeleteCategoryProps {
  categoryId: number
  categoryName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ConfirmDeleteCategory({
  categoryId,
  categoryName,
  open,
  onOpenChange,
}: ConfirmDeleteCategoryProps) {
  const router = useRouter()

  const handleDelete = async () => {
    try {
      const res = await deleteCategory(categoryId)

      if (res?.success) {
        toast.success("Category deleted")
        router.push("/categories")
      } else {
        toast.error(res?.message || "Unknown error")
      }
    } catch (error) {
      console.error(error)
      toast.error("An error occurred, try again")
    }
  }

  const itemName = categoryName ?? "category"

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Are you sure you want to delete this ${itemName}?`}
      description="This can't be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={handleDelete}
    />
  )
}
