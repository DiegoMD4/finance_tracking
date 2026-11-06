"use client"

import { AlertDialogDestructive } from "@/components/ui/alert-dialog-destructive"
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
    <AlertDialogDestructive
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${itemName}?`}
      description="This will permanently delete this category. This can't be undone."
      cancelLabel="Cancel"
      actionLabel="Delete"
      onAction={handleDelete}
    />
  )
}
