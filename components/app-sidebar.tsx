"use client"
import dynamic from "next/dynamic"
import { Landmark, HandCoins, ChartAreaIcon, Tags, LogOut } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTransition } from "react"
import { logout } from "@/server/users/actions"
import { ServerUser } from "@/types/users.types"
import { TooltipProvider } from "./ui/tooltip"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const ThemeButton = dynamic(() => import("./ui/theme-menu-button"), {
  ssr: false,
  loading: () => <div className="h-8 w-full animate-pulse rounded bg-muted" />,
})

const items = [
  { title: "Dashboard", url: "/dashboard", icon: ChartAreaIcon },
  { title: "Bank Accounts", url: "/bank-accounts", icon: Landmark },
  { title: "Transactions", url: "/transactions", icon: HandCoins },
  { title: "Categories", url: "/categories", icon: Tags },
]

export function AppSidebar({ user }: { user: ServerUser }) {
  const router = useRouter()
  const sidebar = useSidebar()
  const pathname = usePathname()
  const [isLoggingOut, startTransition] = useTransition()

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"

  const collapseSidebarOnMobileDevices = () => {
    if (sidebar.state === "expanded" && sidebar.isMobile) {
      sidebar.toggleSidebar()
    }
  }

  const isItemMenuActive = (itemUrl: string) => {
    if (itemUrl === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(itemUrl)
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
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
            {sidebar.state === "expanded" ? "FINANCE TRACKING" : "FT"}
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
                      size={sidebar.state === "expanded" ? "lg" : "default"}
                      /*  size={"lg"} */
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
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {initials}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side="top"
                align="start"
                sideOffset={4}
              >
               {/*  <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                      {initials}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.name}
                      </span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel> */}
                <DropdownMenuSeparator />
                <ThemeButton />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isLoggingOut}
                  onSelect={() => startTransition(() => logout())}
                >
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
