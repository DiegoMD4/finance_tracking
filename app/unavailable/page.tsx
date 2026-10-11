"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getSessionStatus, logout } from "@/server/users/actions"

export default function UnavailablePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const checkSession = useCallback(async () => {
    setIsChecking(true)
    try {
      const status = await getSessionStatus()
      if (status === "authenticated") {
        router.push("/dashboard")
      } else if (status === "unauthenticated") {
        router.push("/")
      }
    } finally {
      setIsChecking(false)
    }
  }, [router])

  useEffect(() => {
    const interval = setInterval(checkSession, 30_000)
    return () => clearInterval(interval)
  }, [checkSession])

  async function handleLogout() {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">
          Service temporarily unavailable
        </h1>
        <p className="text-muted-foreground">
          The database is not reachable right now. We will keep trying
          automatically, or you can check again manually.
        </p>
        <div className="flex gap-3">
          <Button onClick={checkSession} disabled={isChecking}>
            {isChecking ? "Checking…" : "Try again"}
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </div>
    </div>
  )
}