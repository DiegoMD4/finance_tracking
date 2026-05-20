import { createBankAccount } from "@/server/bank_accounts"
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
import Link from "next/link"

export default async function NewInventoryItem() {
  return (
    <section className="w-full">
      <div className="w-full p-3">
        <form
          className="flex flex-row justify-center"
          action={createBankAccount}
        >
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Bank Account</FieldLegend>
              <FieldDescription>
                The account you want to keep track of your transfers, deposits
                and withdrawals.
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
              <Button type="submit" className="cursor-pointer">
                Submit
              </Button>

              <Button
                variant="outline"
                type="button"
                className="cursor-pointer"
                asChild
              >
                <Link href="/bank-accounts" className="cursor-pointer">
                  Cancel
                </Link>
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </section>
  )
}
