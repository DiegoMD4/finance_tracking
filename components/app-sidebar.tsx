"use client"
import dynamic from "next/dynamic"
import { Landmark } from "lucide-react"
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
import Link from "next/link"
import { useRouter } from "next/navigation"
const ThemeButton = dynamic(() => import("./ui/theme-menu-button"), {
  ssr: false,
  loading: () => <div className="h-8 w-full animate-pulse rounded bg-muted" />,
})

const items = [
  { title: "Bank Accounts", url: "/bank-accounts", icon: Landmark },
]

export function AppSidebar() {
  const router = useRouter()
  return (
    <Sidebar variant="floating" collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            className="mb-2 cursor-pointer text-xl"
            onClick={() => {
              router.push("/")
            }}
          >
            Financial Flow
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <TooltipProvider>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon/>
                        <span className="text-sm">{item.title}</span>
                      </Link>
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
          <SidebarMenuItem className="mb-2">
            <ThemeButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                DM
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
