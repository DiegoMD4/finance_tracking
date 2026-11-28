import type { MonthlyPace } from "@/types/dashboard.types"

export interface MonthlyNetMetric {
  /** Ingreso del mes en curso menos gasto del mes en curso. */
  net: number
  /** Porcentaje del ingreso que quedó libre; null si no hubo ingresos. */
  savingsRate: number | null
  /** Diferencia absoluta contra el mismo tramo del mes anterior. */
  delta: number
  /** Variación porcentual; null si la base anterior no es positiva. */
  deltaPercent: number | null
}

export interface RunwayMetric {
  /** Días estimados de balance; null si no hay gasto diario. */
  days: number | null
  /** true cuando se superó el tope de días y conviene mostrar "365+". */
  capped: boolean
}

export interface ProjectedSpendMetric {
  /** Gasto proyectado al cierre del mes. */
  projected: number
  /** Diferencia absoluta contra el mes anterior completo. */
  delta: number
  /** Variación porcentual; null si el mes anterior no tuvo gastos. */
  deltaPercent: number | null
}

const round2 = (value: number) => Number(value.toFixed(2))

/**
 * Cantidad de días del mes. `monthIndex` es 0-based, igual que `Date`.
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Neto del mes en curso y tasa de ahorro.
 *
 * La comparación usa el mismo tramo del mes anterior (día 1 al día actual), no
 * el mes completo, para no comparar un mes parcial contra uno cerrado.
 */
export function computeMonthlyNet(pace: MonthlyPace): MonthlyNetMetric {
  const net = round2(pace.current.income - pace.current.expense)
  const previousNet = round2(
    pace.previousSamePeriod.income - pace.previousSamePeriod.expense
  )
  const delta = round2(net - previousNet)

  const deltaPercent =
    previousNet > 0 ? round2((delta / previousNet) * 100) : null

  const savingsRate =
    pace.current.income > 0 ? round2((net / pace.current.income) * 100) : null

  return { net, savingsRate, delta, deltaPercent }
}

/**
 * Días de balance restantes al ritmo de gasto actual.
 *
 * Usa gasto bruto (no descuenta ingresos), así que es el escenario
 * conservador: asume que el ingreso se corta.
 */
export function computeCashRunway(
  netBalance: number,
  dailyAverage: number,
  maxDays = 365
): RunwayMetric {
  if (dailyAverage <= 0) return { days: null, capped: false }
  if (netBalance <= 0) return { days: 0, capped: false }

  const rawDays = Math.floor(netBalance / dailyAverage)

  return rawDays > maxDays
    ? { days: maxDays, capped: true }
    : { days: rawDays, capped: false }
}

/**
 * Proyección lineal del gasto al cierre del mes.
 *
 * `dailyAverage` ya es el gasto del mes dividido entre los días transcurridos,
 * así que multiplicarlo por los días del mes equivale a
 * `gasto MTD + días restantes × promedio diario`.
 */
export function computeProjectedSpend(pace: MonthlyPace): ProjectedSpendMetric {
  const projected = round2(pace.dailyAverage * pace.daysInMonth)
  const previous = round2(pace.previousFull.expense)
  const delta = round2(projected - previous)

  const deltaPercent = previous > 0 ? round2((delta / previous) * 100) : null

  return { projected, delta, deltaPercent }
}
