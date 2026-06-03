import { z } from "zod"

export const bankAccountSchema = z.object({
  bankName: z
    .string()
    .min(1, { error: "Bank name is required" })
    .max(100, { error: "Bank name is too long" }),
  accountName: z
    .string()
    .min(1, { error: "An account name is required" })
    .max(100, { error: "The account name is too long" }),
  accountNumber: z
    .string()
    .min(1, { error: "Account number is required" })
    .regex(/^\d+$/, { error: "Account number must contain only numbers" })
    .max(19, {
      error: "Account number is too long, it must be 16 digits long",
    }),
  bankAccountType: z.enum(["savings", "checking", "payroll"], {
    error: () => {
      return { message: "Please select a valid account type" }
    },
  }),
  accountEmail: z.email({ error: "Please enter a valid email" }),
  accountCurrency: z.enum(["Lempiras", "Dollars", "Euros"], {
    error: () => {
      return { message: "Please select a currency for this account" }
    },
  }),
  openingBalance: z
    .string()
    .min(1, { message: "Opening balance is required" })
    .regex(/^[0-9.,]+$/, {
      message: "Invalid format. Only numbers, periods, and commas are allowed",
    })
    .transform((val) => {
      let cleanVal = val.replace(/\s/g, "")
      cleanVal = cleanVal.replace(/,/g, "")

      const num = parseFloat(cleanVal)

      return isNaN(num) ? 0 : num
    }),
})
