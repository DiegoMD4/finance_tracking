import { z } from "zod"

export const transactionCurrencySchema = z.enum(["HNL", "USD", "EUR"], {
  error: () => ({ message: "Please select a valid currency" }),
})

export const transactionSchema = z.object({
  accountId: z
    .string()
    .trim()
    .min(1, { error: "Bank account is required" })
    .regex(/^\d+$/, { error: "Bank account is invalid" })
    .transform((value) => Number(value)),
  amount: z
    .string()
    .trim()
    .min(1, { error: "Amount is required" })
    .regex(/^\d+(?:[.,]\d{1,2})?$/, {
      error: "Amount must be a valid number with up to 2 decimals",
    })
    .transform((value) => value.replace(",", ".")),
  transactionType: z.enum(["income", "expense"], {
    error: () => ({ message: "Please select a valid transaction type" }),
  }),
  transactionDescription: z
    .string()
    .trim()
    .max(255, { error: "Description is too long" })
    .optional()
    .transform((value) => {
      if (!value) {
        return null
      }

      return value
    }),
  transactionDate: z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === ""
          ? "Required"
          : "Invalid date",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date" })
    .refine(
      (value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()),
      { error: "Invalid date" },
    )
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine((data) => data <= new Date(), {
      error: "Can't submit a future date",
    }),
  transactionCurrency: transactionCurrencySchema.default("HNL"),
})

export const bulkTransactionSchema = z.object({
  accountId: z
    .string()
    .trim()
    .min(1, { error: "Bank account is required" })
    .regex(/^\d+$/, { error: "Bank account is invalid" })
    .transform((value) => Number(value)),
  amount: z
    .string()
    .trim()
    .min(1, { error: "Amount is required" })
    .regex(/^\d+(?:[.,]\d{1,2})?$/, {
      error: "Amount must be a valid number with up to 2 decimals",
    })
    .transform((value) => value.replace(",", ".")),
  transactionType: z.enum(["income", "expense"], {
    error: () => ({ message: "Please select a valid transaction type" }),
  }),
  transactionDescription: z
    .string()
    .trim()
    .max(255, { error: "Description is too long" })
    .optional()
    .transform((value) => {
      if (!value) {
        return null
      }

      return value
    }),
  transactionDate: z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === ""
          ? "Required"
          : "Invalid date",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date" })
    .refine(
      (value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()),
      { error: "Invalid date" },
    )
    .transform((value) => new Date(`${value}T00:00:00`))
    .refine((data) => data <= new Date(), {
      error: "Can't submit a future date",
    }),
  bankReference: z.string().trim().nullable().optional().transform((value) => {
    if (!value) {
      return null
    }

    return value
  }),
  categoryId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z
      .string()
      .trim()
      .regex(/^\d+$/, { error: "Category is invalid" })
      .transform((value) => Number(value))
      .nullable()
  ),
})
