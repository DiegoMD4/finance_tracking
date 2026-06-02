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
import { createBankAccount, updateBankAccount } from "@/server/bank_accounts"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"
import { BankAccountActionState, BankAccounts } from "@/types/bank-accounts.types"

interface FormBankAccountsProps {
  bankAccount?: BankAccounts
  formType?: "CREATE" | "EDIT" | "VIEW"
}

export default function FormBankAccounts({
  bankAccount,
  formType = "CREATE",
}: FormBankAccountsProps) {
  const router = useRouter()
  const formDispatcher = async (
    prevState: BankAccountActionState,
    formData: FormData
  ) => {
    if (formType === "EDIT") {
      return updateBankAccount(prevState, formData)
    }

    return createBankAccount(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

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
    <form
      className="flex flex-row justify-center"
      action={formAction}
      autoComplete="off"
    >
      {bankAccount?.id && (
        <input type="hidden" name="id" value={bankAccount.id} />
      )}
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

              <Input
                id="checkout-bank-name"
                placeholder="Your bank"
                name="bankName"
                autoComplete="off"
                defaultValue={bankAccount?.bankName ?? state?.fields.bankName}
                aria-invalid={!!state?.error?.bankName}
              />
              {!state?.success && (
                <FieldError>{state?.error?.bankName}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="checkout-account-number">
                Account Number
              </FieldLabel>

              <Input
                id="checkout-account-number"
                placeholder="1234 5678 9012 3456 10"
                name="accountNumber"
                autoComplete="off"
                defaultValue={
                  bankAccount?.accountNumber ?? state?.fields.accountNumber
                }
                aria-invalid={!!state?.error?.accountNumber}
              />
              <FieldDescription>
                Enter your 19-digit account number
              </FieldDescription>
              {!state?.success && (
                <FieldError>{state?.error?.accountNumber}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-email">Account email</FieldLabel>

              <Input
                id="checkout-email"
                placeholder="your-email@.com"
                name="email"
                autoComplete="off"
                defaultValue={
                  bankAccount?.accountEmail ?? state?.fields?.accountEmail
                }
                aria-invalid={!!state?.error?.accountEmail}
              />
              <FieldDescription>
                This email will be used to check new transactions automatically.
              </FieldDescription>
              <FieldError>{state?.error?.accountEmail}</FieldError>
            </Field>
          </FieldGroup>

          <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
            <Field className="w-60">
              <FieldLabel htmlFor="checkout-account-type">
                Account type
              </FieldLabel>

              <Select
                name="bankAccountType"
                defaultValue={
                  bankAccount?.bankAccountType ?? state?.fields.bankAccountType
                }
              >
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
              {state?.error?.bankAccountType && (
                <FieldError>Please select one account type</FieldError>
              )}
            </Field>
            <Field className="w-70">
              <FieldLabel htmlFor="checkout-currency">Currency</FieldLabel>

              <Select
                name="currency"
                defaultValue={
                  bankAccount?.accountCurrency ?? state?.fields.accountCurrency
                }
              >
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
              {state?.error?.accountCurrency && (
                <FieldError>Please select the account currency</FieldError>
              )}
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
