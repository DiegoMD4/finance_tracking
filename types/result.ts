export type ErrorCode =
  | "database"
  | "not_found"
  | "duplicate"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "unknown"

export type AppError = {
  code: ErrorCode
  message: string
  cause?: unknown
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export type Paginated<T> = {
  items: T[]
  hasMore: boolean
}

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })

export const err = (
  code: ErrorCode,
  message: string,
  cause?: unknown
): Result<never> => ({ ok: false, error: { code, message, cause } })