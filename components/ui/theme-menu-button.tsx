import { useTheme } from "next-themes"
import { SidebarMenuButton } from "./sidebar"
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
    <SidebarMenuButton asChild onClick={changeTheme} className="cursor-pointer">
      <span className="truncate font-semibold">
        <SunMoon />
        <span className="text-lg capitalize">{theme ?? 'system'}</span>
      </span>
    </SidebarMenuButton>
  )
}
