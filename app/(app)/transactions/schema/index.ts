import { z } from "zod"

import { canonicalAmount, DEDUPE_MAX_OCCURRENCE } from "@/lib/transactions/dedupe"

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

const isoDateString = z
  .string({
    error: (issue) =>
      issue.input === undefined || issue.input === ""
        ? "Snapshot date is required"
        : "Snapshot date is invalid",
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Snapshot date is invalid" })
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()),
    { error: "Snapshot date is invalid" },
  )

/**
 * Snapshot de identidad tal como lo produjo el parser. Es dato de cliente: se
 * canonicaliza acá (fecha ISO real, monto a 2 decimales, moneda del catálogo)
 * antes de calcular el hash. Un snapshot inválido rechaza la fila; no se
 * guarda sin hash en silencio.
 */
export const dedupeOriginalSchema = z.object({
  date: isoDateString,
  amount: z
    .string()
    .trim()
    .min(1, { error: "Snapshot amount is required" })
    .refine((value) => canonicalAmount(value) !== null, {
      error: "Snapshot amount is invalid",
    }),
  type: z.enum(["income", "expense"], {
    error: () => ({ message: "Snapshot type is invalid" }),
  }),
  reference: z
    .string()
    .trim()
    .max(255, { error: "Snapshot reference is too long" })
    .nullable()
    .optional()
    .transform((value) => value || null),
  description: z
    .string()
    .trim()
    .max(255, { error: "Snapshot description is too long" })
    .optional()
    .transform((value) => value ?? ""),
  currency: transactionCurrencySchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
})

export const dedupeSnapshotSchema = z.object({
  original: dedupeOriginalSchema,
  occurrence: z
    .number({
      error: () => ({ message: "Snapshot occurrence is invalid" }),
    })
    .int({ error: "Snapshot occurrence is invalid" })
    .min(1, { error: "Snapshot occurrence is invalid" })
    .max(DEDUPE_MAX_OCCURRENCE, { error: "Snapshot occurrence is invalid" }),
})
