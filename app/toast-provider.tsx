"use client"
import { useTheme } from "next-themes"
import { Toaster } from "sonner"

export function ToastProvider() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme as "light" | "dark" | "system"}
      richColors
      closeButton
      position="bottom-right"
    />
  )
}
