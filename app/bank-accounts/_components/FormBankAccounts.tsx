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
  FieldError,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createBankAccount } from "@/server/bank_accounts"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

export default function FormBankAccounts() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createBankAccount, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state?.message)
      return router.push("/bank-accounts")
    } else {
      toast.error(state.message)
    }
  }, [state, router])

  return (
    <form className="flex flex-row justify-center" action={formAction} autoComplete="off">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Bank Account</FieldLegend>
          <FieldDescription>
            The account you want to keep track of your transfers, deposits and
            withdrawals.
          </FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="checkout-bank-name">Bank Name</FieldLabel>
              {!state?.success && (
                <FieldError>{state?.error?.bankName}</FieldError>
              )}
              <Input
                id="checkout-bank-name"
                placeholder="Your bank"
                name="bankName"
                autoComplete="off"
                defaultValue={state?.fields.bankName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-account-number">
                Account Number
              </FieldLabel>
              {!state?.success && (
                <FieldError>{state?.error?.accountNumber}</FieldError>
              )}
              <Input
                id="checkout-account-number"
                placeholder="1234 5678 9012 3456"
                name="accountNumber"
                autoComplete="off"
                defaultValue={state?.fields.accountNumber}
              />
              <FieldDescription>
                Enter your 16-digit card number
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-email">Account email</FieldLabel>
              {!state?.success && (
                <p className="text-xs text-red-400">
                  {state?.error?.accountEmail}
                </p>
              )}
              <Input
                id="checkout-email"
                placeholder="your-email@.com"
                name="email"
                autoComplete="off"
                defaultValue={state?.fields?.accountEmail}
              />
              <FieldDescription>
                This email will be used to check new transactions automatically
              </FieldDescription>
            </Field>
          </FieldGroup>

          <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
            <Field
              className="w-60" /* data-invalid={!!state?.error?.bankAccountType} */
            >
              <FieldLabel htmlFor="checkout-account-type">
                Account type
              </FieldLabel>
              {state?.error?.bankAccountType && (
                <FieldError>Please select one account type</FieldError>
              )}
              <Select name="bankAccountType">
                <SelectTrigger
                  id="checkout-account-type"
                  aria-invalid={!!state?.error?.bankAccountType}
                >
                  <SelectValue placeholder="Select an account type" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="savings">Savings account</SelectItem>
                    <SelectItem value="checking">Checking account</SelectItem>
                    <SelectItem value="payroll">Payroll account</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field
              className="w-70" /* data-invalid={!!state?.error?.bankAccountType} */
            >
              <FieldLabel htmlFor="checkout-currency">Currency</FieldLabel>
              {state?.error?.accountCurrency && (
                <FieldError>Please select the account currency</FieldError>
              )}
              <Select name="currency">
                <SelectTrigger
                  id="checkout-currency"
                  aria-invalid={!!state?.error?.accountCurrency}
                >
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="Lempiras">Lempiras</SelectItem>
                    <SelectItem value="Dollars">Dollars</SelectItem>
                    <SelectItem value="Euros">Euros</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
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
              Back
            </Link>
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
