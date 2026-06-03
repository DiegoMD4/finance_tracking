"use client"
import dynamic from "next/dynamic"
import { Landmark, HandCoins } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "./ui/tooltip"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
const ThemeButton = dynamic(() => import("./ui/theme-menu-button"), {
  ssr: false,
  loading: () => <div className="h-8 w-full animate-pulse rounded bg-muted" />,
})

const items = [
  { title: "Bank Accounts", url: "/bank-accounts", icon: Landmark },
  { title: "Transactions", url: "/transactions", icon: HandCoins },
]

export function AppSidebar() {
  const router = useRouter()
  const sidebar = useSidebar()
  const pathname = usePathname()

  const collapseSidebarOnMobileDevices = () => {
    if (sidebar.state === "expanded" && sidebar.isMobile) {
      sidebar.toggleSidebar()
    }
  }

  const isItemMenuActive = (itemUrl: string) => {
    return pathname.includes(itemUrl)
  }

  return (
    <Sidebar variant="floating" collapsible="offcanvas">
      <SidebarContent
        onClick={() => {
          collapseSidebarOnMobileDevices()
        }}
      >
        <SidebarGroup>
          <SidebarHeader
            className="mb-2 cursor-pointer text-xl"
            onClick={() => {
              router.push("/")
            }}
          >
            Finance Tracking
          </SidebarHeader>
          <SidebarGroupContent>
            <TooltipProvider>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isItemMenuActive(item.url)}
                      size={'lg'}
                    >
                      <Link href={item.url}>
                        <item.icon />
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
