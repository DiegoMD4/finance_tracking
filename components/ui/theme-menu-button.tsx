'use client'
import { useTheme } from "next-themes"
import { DropdownMenuItem } from "./dropdown-menu"
import { SunMoon } from "lucide-react"

export default function ThemeMenuButton() {
  const { setTheme, themes, theme } = useTheme()
  const changeTheme = () => {
    const selectThemeIndex = themes.indexOf(theme ?? "system")
    const newTheme =
      selectThemeIndex === themes.length - 1
        ? themes[0]
        : themes[selectThemeIndex + 1]
    setTheme(newTheme)
  }
  return (
    <DropdownMenuItem onClick={changeTheme} className="cursor-pointer">
      <SunMoon />
      <span className="capitalize">{theme ?? "system"}</span>
    </DropdownMenuItem>
  )
}
