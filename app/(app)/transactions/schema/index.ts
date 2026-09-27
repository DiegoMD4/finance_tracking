import { z } from "zod"

export const transactionSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, { error: "User is required" })
    .regex(/^\d+$/, { error: "User is invalid" })
    .transform((value) => Number(value)),
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
 /*  categoryId: z
    .string()
    .trim()
    .min(1, { error: "A category for this transactions is needed" })
    .regex(/^\d+$/, { error: "A category for this transactions is needed" })
    .transform((value) => Number(value)), */
})
