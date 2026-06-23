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
import { createTransaction } from "@/server/transactions/server"
import { BankAccounts } from "@/types/bank-accounts.types"
import { CategoriesList } from "@/types/categories.types"
import {
  Transaction,
  TransactionsActionState,
} from "@/types/transactions.types"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useMemo } from "react"
import { toast } from "sonner"

interface FormTransactionProps {
  bankAccounts: BankAccounts[]
  categories: CategoriesList[]
  transaction?: Transaction
  formType?: 'VIEW' | 'NEW'
}

export default function FormTransaction({
  bankAccounts,
  categories,
  transaction,
  formType = 'NEW'
}: FormTransactionProps) {
  const router = useRouter()

  const hasAccounts = useMemo(() => bankAccounts.length > 0, [bankAccounts])

  const formDispatcher = async (
    prevState: TransactionsActionState,
    formData: FormData
  ) => {
    return createTransaction(prevState, formData)
  }

  const [state, formAction, isPending] = useActionState(formDispatcher, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      toast.success(state.message)
      router.push("/transactions")
      return
    }

    toast.error(state.message)
  }, [state, router])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value
    const cleanedValue = inputValue.replace(/[^0-9.,]/g, "")
    event.target.value = cleanedValue
  }

  return (
    <form
      className="flex flex-row justify-center"
      action={formAction}
      autoComplete="off"
    >
      <input type="hidden" name="userId" value={state?.fields?.userId ?? "1"} />
      <FieldGroup>
        <FieldSet>
          <FieldLegend>New Transaction</FieldLegend>
          <FieldDescription>
            Register income and expenses to keep your account balances updated.
          </FieldDescription>

          <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="checkout-account">Bank account</FieldLabel>
              <Select
                name="accountId"
                defaultValue={
                  transaction?.accountId.toString() ?? state?.fields?.accountId
                }
              >
                <SelectTrigger
                  id="checkout-account"
                  aria-invalid={!!state?.error?.accountId}
                >
                  <SelectValue
                    placeholder={
                      hasAccounts
                        ? "Select an account"
                        : "No bank accounts available for this user"
                    }
                  />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {bankAccounts.map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id.toString()}
                      >
                        {account.accountName || "Unnamed account"} -{" "}
                        {account.bankName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {!hasAccounts && (
                <FieldDescription>
                  You need at least one bank account before creating a
                  transaction.
                </FieldDescription>
              )}
              <FieldError>{state?.error?.accountId}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="checkout-transaction-type">
                Transaction type
              </FieldLabel>
              <Select
                name="transactionType"
                defaultValue={
                  transaction?.transactionType ?? state?.fields?.transactionType
                }
              >
                <SelectTrigger
                  id="checkout-transaction-type"
                  aria-invalid={!!state?.error?.transactionType}
                >
                  <SelectValue placeholder="Select a transaction type" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{state?.error?.transactionType}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="checkout-amount">Amount</FieldLabel>
              <Input
                id="checkout-amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={transaction?.amount ?? state?.fields?.amount}
                onChange={handleAmountChange}
                aria-invalid={!!state?.error?.amount}
              />
              <FieldDescription>
                Use up to 2 decimals. Examples: 100 or 150.25
              </FieldDescription>
              <FieldError>{state?.error?.amount}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-categoryId">
                Transaction category
              </FieldLabel>
              <Select
                name="categoryId"
                defaultValue={
                  transaction?.categoryId?.toString() ??
                  state?.fields?.categoryId
                }
              >
                <SelectTrigger
                  id="checkout-categoryId"
                  aria-invalid={!!state?.error?.categoryId}
                >
                  <SelectValue placeholder="Select a transaction category">
                    {transaction?.categoryName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {categories.map((cat) => (
                      <SelectItem
                        value={cat.categoryId.toString()}
                        key={cat.categoryId}
                      >
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{state?.error?.categoryId}</FieldError>
            </Field>

            <Field className="md:col-span-2">
              <FieldLabel htmlFor="checkout-description">
                Description
              </FieldLabel>
              <Input
                id="checkout-description"
                name="transactionDescription"
                placeholder="Optional transaction note"
                defaultValue={
                  transaction?.transactionDescription ??
                  state?.fields?.transactionDescription
                }
                aria-invalid={!!state?.error?.transactionDescription}
              />
              <FieldDescription>
                Optional. Include context like payment method or category
                details.
              </FieldDescription>
              <FieldError>{state?.error?.transactionDescription}</FieldError>
            </Field>
          </FieldGroup>
        </FieldSet>

        {formType !== "VIEW" && (
          <>
            <FieldSeparator />
            <Field orientation="horizontal">
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={isPending || !hasAccounts}
              >
                {isPending ? "Submitting" : "Submit"}
              </Button>

              <Button
                variant="outline"
                type="button"
                className="cursor-pointer"
                asChild
                disabled={isPending}
              >
                <Link href="/transactions" className="cursor-pointer">
                  Back
                </Link>
              </Button>
            </Field>
          </>
        )}
      </FieldGroup>
    </form>
  )
}
