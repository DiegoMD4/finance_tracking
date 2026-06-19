// app/dashboard/error.tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Error capturado:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <h2 className="text-xl font-bold">¡La base de datos está despertando!</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Parece que el servidor de datos estaba inactivo y tardó un poco más de
        lo normal en responder.
      </p>
      <Button onClick={() => reset()}>Reintentar conexión</Button>
    </div>
  )
}
