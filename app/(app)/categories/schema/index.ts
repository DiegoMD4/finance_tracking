import { z } from "zod"
import { CATEGORY_ICON_KEYS } from "@/lib/category-icons"

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Category name is required" })
    .max(255, { error: "Category name is too long" }),
  icon: z.enum(CATEGORY_ICON_KEYS, {
    error: () => ({ message: "Please select a valid icon" }),
  }),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, {
      error: "Color must be a valid hex code, e.g. #64748b",
    }),
})
