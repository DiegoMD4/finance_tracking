"use client"

import { useEffect, startTransition, useState } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    console.error("Error capturado:", error)
  }, [error])

  const handleRetry = () => {
    setIsRetrying(true)

    startTransition(() => {
      reset()

      setTimeout(() => setIsRetrying(false), 1000)
    })
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h2 className="text-xl font-bold">
        An unexpected error occurred. Please try again.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Something went wrong while loading the page content.
      </p>

      <Button onClick={handleRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Reload page"}
      </Button>
    </div>
  )
}
