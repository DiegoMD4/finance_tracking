export interface MonthlyFinancial {
  monthNumber: number
  month: string
  income: number
  expense: number
}

export interface DailyAverage {
  monthTotal: number
  dailyAverage: number
  currentDay: number
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