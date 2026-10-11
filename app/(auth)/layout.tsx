import { redirect } from "next/navigation"

import { getSessionUserInfo } from "@/server/session"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionUserInfo()

  if (session.status === "authenticated") {
    redirect("/dashboard")
  }

  if (session.status === "db-unavailable") {
    redirect("/unavailable")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      {children}
    </div>
  )
}
