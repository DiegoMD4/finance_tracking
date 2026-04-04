"use client"
import {
  MapPin,
  LayoutDashboard,
  Settings,
  Utensils,
  SunMoon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "./ui/tooltip"
import { useTheme } from "next-themes"

const items = [
  { title: "Dashboard", url: "#", icon: LayoutDashboard },
  { title: "Lugares", url: "#", icon: MapPin },
  { title: "Sucursales", url: "#", icon: Utensils },
  { title: "Configuración", url: "#", icon: Settings },
]

export function AppSidebar() {
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
    <Sidebar variant="floating" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <TooltipProvider>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </TooltipProvider>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              onClick={changeTheme}
              className="cursor-pointer"
            >
              <span className="truncate font-semibold">
                <SunMoon size={90} />
                <span className="text-lg capitalize">{theme ?? "system"}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                JD
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Diego Montoya</span>
                <span className="truncate text-xs">Admin Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
