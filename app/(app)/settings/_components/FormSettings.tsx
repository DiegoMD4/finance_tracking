"use client"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { updateDefaultCurrency } from "@/server/users/actions"
import { UpdateDefaultCurrency } from "@/types/users.types"
import { useActionState, useEffect } from "react"
import { toast } from "sonner"

const CURRENCY_OPTIONS = [
  { value: "HNL", label: "HNL — Lempira hondureño" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
]

interface FormSettingsProps {
  currentCurrency: string
}

export function FormSettings({ currentCurrency }: FormSettingsProps) {
  const formDispatcher = async (
    prevState: UpdateDefaultCurrency | null | undefined,
    formData: FormData
  ) => {
    return updateDefaultCurrency(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state.message)
      return
    }

    toast.error(state.message)
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-4" autoComplete="off">
      <FieldGroup>
        <FieldSet>
          <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="settings-currency">Default currency</FieldLabel>
              <Select name="currency" defaultValue={currentCurrency}>
                <SelectTrigger id="settings-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                This currency is used to display all monetary amounts across the
                system. Changing it will not alter previously captured
                transaction values.
              </FieldDescription>
              <FieldError>{state?.error?.currency}</FieldError>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <FieldSeparator />
      <Field orientation="horizontal">
        <Button type="submit" className="cursor-pointer" disabled={isPending}>
          {isPending ? "Saving" : "Save"}
        </Button>
      </Field>
    </form>
  )
}
