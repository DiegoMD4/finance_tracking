import { redirect } from "next/navigation"

import { getCurrentUserId } from "@/lib/jwt"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = await getCurrentUserId()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      {children}
    </div>
  )
}
