import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb"

import { redirect } from "next/navigation"

import { getCurrentUserId } from "@/lib/jwt"
import { getUserById } from "@/server/users/queries"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userId = await getCurrentUserId()

  if (!userId) {
    redirect("/")
  }

  const userResult = await getUserById(userId)

  if (!userResult.success || !userResult.data) {
    redirect("/")
  }

  return (
    <SidebarProvider>
      <AppSidebar user={userResult.data} />
      <SidebarInset>
        <header className="flex h-16 items-center justify-items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2" />
            <DynamicBreadcrumb />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
