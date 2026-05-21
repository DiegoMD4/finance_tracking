"use client"
import { Button } from "@/components/ui/button"
import {
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldDescription,
  Field,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createBankAccount } from "@/server/bank_accounts"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

export default function FormBankAccounts() {
  const [state, formAction, isPending] = useActionState(createBankAccount, null)
  const router = useRouter()
  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state?.message || "Cuenta creada con éxito", {
        position: "bottom-right",
      })
      return router.push("/bank-accounts")
    } else {
      toast.error(state.message || "Hubo un error", {
        position: "bottom-right",
      })
    }
  }, [state, router])

  return (
    <form className="flex flex-row justify-center" action={formAction}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Bank Account</FieldLegend>
          <FieldDescription>
            The account you want to keep track of your transfers, deposits and
            withdrawals.
          </FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="checkout-7j9-card-name-43j">
                Bank Name
              </FieldLabel>
              <Input
                id="checkout-7j9-card-name-43j"
                placeholder="Your bank"
                required
                name="bankName"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-7j9-card-number-uw1">
                Account Number
              </FieldLabel>
              <Input
                id="checkout-7j9-card-number-uw1"
                placeholder="1234 5678 9012 3456"
                required
                name="accountNumber"
                autoComplete="off"
              />
              <FieldDescription>
                Enter your 16-digit card number
              </FieldDescription>
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
            <Link href="/bank-accounts" className="cursor-pointer">
              Cancel
            </Link>
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
