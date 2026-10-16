import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* export const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0.00"
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
} */
const CURRENCY_SYMBOLS = { HNL: "L.", USD: "$", EUR: "€" }
type Currency = keyof typeof CURRENCY_SYMBOLS

export type { Currency }

export function formatCurrency(value: string | number, currency: Currency = "HNL") {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0.00"
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  return `${symbol} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`
}

export function formatCompactCurrency(value: string | number, currency: Currency = "HNL") {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0"
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  return `${symbol} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(num)}`
}

/* const mesesEspañol: Record<string, string> = {
  January: "Ene", February: "Feb", March: "Mar", April: "Abr", 
  May: "May", June: "Jun", July: "Jul", August: "Ago", 
  September: "Sep", October: "Oct", November: "Nov", December: "Dic"
} */

// Y en tu componente lo usas así:
/* tickFormatter={(value) => mesesEspañol[value] || value} */
