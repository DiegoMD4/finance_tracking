"use client"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CATEGORY_ICONS } from "@/lib/category-icons"
import { createCategory, updateCategory } from "@/server/categories/actions"
import { Category, CategoriesActionState } from "@/types/categories.types"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

interface FormCategoryProps {
  category?: Category
  formType?: "NEW" | "EDIT"
}

const DEFAULT_COLOR = "#64748b"

export default function FormCategory({
  category,
  formType = "NEW",
}: FormCategoryProps) {
  const router = useRouter()

  const [color, setColor] = useState<string>(
    () => category?.color ?? DEFAULT_COLOR
  )

  const formDispatcher = async (
    prevState: CategoriesActionState,
    formData: FormData
  ) => {
    if (formType === "EDIT") {
      return updateCategory(prevState, formData)
    }

    return createCategory(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state.message)
      router.push("/categories")
      return
    }

    toast.error(state.message)
  }, [state, router])

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setColor(event.target.value)
  }

  return (
    <form
      className="flex flex-row justify-center"
      action={formAction}
      autoComplete="off"
    >
      {category?.categoryId && (
        <input type="hidden" name="id" value={category.categoryId} />
      )}
      <FieldGroup>
        <FieldSet>
          <FieldLegend>
            {formType === "EDIT" ? "Edit Category" : "New Category"}
          </FieldLegend>
          <FieldDescription>
            Categories help you group and analyze your income and expenses.
          </FieldDescription>

          <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="checkout-name">Name</FieldLabel>
              <Input
                id="checkout-name"
                name="name"
                placeholder="e.g. Groceries"
                defaultValue={category?.name ?? state?.fields?.name}
                aria-invalid={!!state?.error?.name}
              />
              <FieldError>{state?.error?.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="checkout-icon">Icon</FieldLabel>
              <Select
                name="icon"
                defaultValue={
                  category?.icon ?? state?.fields?.icon ?? undefined
                }
              >
                <SelectTrigger
                  id="checkout-icon"
                  aria-invalid={!!state?.error?.icon}
                >
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {CATEGORY_ICONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <option.icon className="size-4" />
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{state?.error?.icon}</FieldError>
            </Field>

            <Field className="md:col-span-2">
              <FieldLabel htmlFor="checkout-color">Color</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick a color"
                  value={color}
                  onChange={handleColorChange}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded-none border border-input bg-transparent p-0.5"
                />
                <Input
                  id="checkout-color"
                  name="color"
                  placeholder={DEFAULT_COLOR}
                  value={color}
                  onChange={handleColorChange}
                  aria-invalid={!!state?.error?.color}
                />
              </div>
              <FieldDescription>
                Hex color code, e.g. {DEFAULT_COLOR}
              </FieldDescription>
              <FieldError>{state?.error?.color}</FieldError>
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />
        <Field orientation="horizontal">
          <Button type="submit" className="cursor-pointer" disabled={isPending}>
            {isPending ? "Submitting" : "Submit"}
          </Button>

          <Button
            variant="outline"
            type="button"
            className="cursor-pointer"
            asChild
            disabled={isPending}
          >
            <Link href="/categories" className="cursor-pointer">
              Back
            </Link>
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
