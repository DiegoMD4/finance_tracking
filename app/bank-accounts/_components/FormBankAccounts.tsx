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

import Link from "next/link"
import { useRouter } from "next/navigation"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  BankAccountActionState,
  BankAccounts,
} from "@/types/bank-accounts.types"
import { createBankAccount, updateBankAccount } from "../server/server"

interface FormBankAccountsProps {
  bankAccount?: BankAccounts
  formType?: "CREATE" | "EDIT" | "VIEW"
  name?: string;
}

export default function FormBankAccounts({
  bankAccount,
  formType = "CREATE",
  name
}: FormBankAccountsProps) {
  const [balance, setBalance] = useState<string>(() => {
    return bankAccount?.openingBalance?.toString() ?? ""
  })
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

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const cleanedValue = inputValue.replace(/[^0-9.,]/g, "")

    setBalance(cleanedValue)
  }

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
          <FieldLegend>{name ? `${name}` : "Bank Account"}</FieldLegend>
          <FieldDescription>
            The account you want to keep track of your transfers, deposits and
            withdrawals.
          </FieldDescription>
          <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
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
              <FieldLabel htmlFor="checkout-account-name">
                Account Name
              </FieldLabel>

              <Input
                id="checkout-account-name"
                placeholder="A name to identify this account"
                name="accountName"
                autoComplete="off"
                defaultValue={
                  bankAccount?.accountName ?? state?.fields.accountName
                }
                aria-invalid={!!state?.error?.accountName}
              />
              {!state?.success && (
                <FieldError>{state?.error?.accountName}</FieldError>
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
                Enter your 19-digit account number.
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
                inputMode="email"
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
            <Field>
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
                <FieldError>{state.error.bankAccountType}</FieldError>
              )}
            </Field>
            <Field>
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
                <FieldError>{state.error.accountCurrency}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-balance">
                Opening balance
              </FieldLabel>

              <Input
                id="checkout-balance"
                placeholder="1,000"
                name="openingBalance"
                autoComplete="off"
                inputMode="decimal"
                value={balance}
                onChange={handleBalanceChange}
                aria-invalid={!!state?.error?.openingBalance}
              />

              <FieldError>{state?.error?.openingBalance}</FieldError>
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
