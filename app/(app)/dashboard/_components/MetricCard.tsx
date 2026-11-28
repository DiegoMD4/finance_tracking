import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface MetricCardProps {
  /** Icono ya estilizado: el caller define color y tamaño. */
  icon: ReactNode
  label: string
  value: ReactNode
  /** Clase extra para el valor (por ejemplo, el color según el signo). */
  valueClassName?: string
  /** Línea secundaria debajo del valor. */
  footer?: ReactNode
  className?: string
}

/**
 * Card compacta del dashboard: icono y label arriba, valor grande abajo.
 * Mismo lenguaje visual que TOTAL NET BALANCE y DAILY SPENT AVERAGE.
 */
export function MetricCard({
  icon,
  label,
  value,
  valueClassName,
  footer,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-between rounded-xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4",
        className
      )}
    >
      <div className="flex items-start justify-between">
        {icon}
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          "flex flex-col gap-y-2 text-2xl font-bold",
          valueClassName
        )}
      >
        {value}
        {footer ? (
          <div className="flex flex-row gap-x-4">
            <span className="text-xs font-normal text-muted-foreground">
              {footer}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
