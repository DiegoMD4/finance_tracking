import {
  Banknote,
  Car,
  CircleEllipsis,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  LucideIcon,
  ShoppingBag,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
} from "lucide-react"

export const CATEGORY_ICON_KEYS = [
  "home",
  "utensils",
  "car",
  "shopping-bag",
  "banknote",
  "heart-pulse",
  "graduation-cap",
  "trending-up",
  "circle-ellipsis",
  "tag",
  "landmark",
  "wallet",
] as const

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number]

interface CategoryIconOption {
  key: CategoryIconKey
  label: string
  icon: LucideIcon
}

export const CATEGORY_ICONS: CategoryIconOption[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "utensils", label: "Food & Dining", icon: Utensils },
  { key: "car", label: "Transportation", icon: Car },
  { key: "shopping-bag", label: "Shopping", icon: ShoppingBag },
  { key: "banknote", label: "Income", icon: Banknote },
  { key: "heart-pulse", label: "Health", icon: HeartPulse },
  { key: "graduation-cap", label: "Education", icon: GraduationCap },
  { key: "trending-up", label: "Investments", icon: TrendingUp },
  { key: "circle-ellipsis", label: "Miscellaneous", icon: CircleEllipsis },
  { key: "tag", label: "Tag", icon: Tag },
  { key: "landmark", label: "Bank", icon: Landmark },
  { key: "wallet", label: "Wallet", icon: Wallet },
]

const FALLBACK_ICON: LucideIcon = Tag

export function getCategoryIcon(key: string | null | undefined): LucideIcon {
  const match = CATEGORY_ICONS.find((option) => option.key === key)

  return match?.icon ?? FALLBACK_ICON
}
