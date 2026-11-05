"use client"

import { useRouter } from "next/navigation"

interface ErrorBannerProps {
  errors: Array<{ query: string; message: string }>
}

export function ErrorBanner({ errors }: ErrorBannerProps) {
  const router = useRouter()

  const failedQueries = errors.map((e) => e.query).join(", ")
  const firstMessage = errors[0]?.message

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500 bg-red-50 p-4 text-red-900 mb-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Error al cargar el dashboard</h3>
          <p className="text-xs mt-1">
            No se pudieron cargar los datos de{" "}
            <span className="font-medium">{failedQueries}</span
            >. {firstMessage}
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
