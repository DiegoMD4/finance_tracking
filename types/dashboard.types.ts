export interface MonthlyFinancial {
  year: number
  monthNumber: number
  month: string
  income: number
  expense: number
}

export interface MonthTotals {
  income: number
  expense: number
}

export interface MonthlyPace {
  /** Día del mes en curso (1..daysInMonth). */
  currentDay: number
  daysInMonth: number
  daysInPreviousMonth: number
  /** Totales del mes en curso hasta hoy (MTD). */
  current: MonthTotals
  /** Mes anterior, desde el día 1 hasta el mismo día del mes en curso. */
  previousSamePeriod: MonthTotals
  /** Mes anterior completo, para proyectar un mes entero. */
  previousFull: MonthTotals
  /** Gasto del mes en curso. Se mantiene por compatibilidad con la card existente. */
  monthTotal: number
  /** Gasto del mes en curso dividido entre los días transcurridos. */
  dailyAverage: number
}

export interface FundShare {
  name: string
  type: string | null
  value: number
}

export interface CategoryExpense {
  categoryName: string
  categoryColor: string | null
  categoryIcon: string | null
  total_amount: number
}
