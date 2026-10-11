import { db } from "@/db"
import { users } from "@/db/schema/schema"
import { ServerUser } from "@/types/users.types"
import { eq } from "drizzle-orm"

const DB_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EPROTO",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "POOL_CLOSED",
])

const DB_UNAVAILABLE_ERRNOS = new Set([-4078, -4039, -4037])

const DB_UNAVAILABLE_MESSAGE_PATTERN =
  /can't reach database server|connect econnrefused|connection lost|handshake inactivity/i

export function matchesDbUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false

  const { code, errno, message } = error as {
    code?: string
    errno?: number
    message?: string
  }

  if (code && DB_UNAVAILABLE_CODES.has(code)) return true
  if (typeof errno === "number" && DB_UNAVAILABLE_ERRNOS.has(errno)) return true
  if (
    typeof message === "string" &&
    DB_UNAVAILABLE_MESSAGE_PATTERN.test(message)
  ) {
    return true
  }

  return false
}

export function isDbUnavailableError(error: unknown): boolean {
  const visited = new Set<unknown>()
  let current: unknown = error

  while (
    current !== null &&
    typeof current === "object" &&
    !visited.has(current)
  ) {
    if (matchesDbUnavailable(current)) return true
    visited.add(current)
    current = (current as { cause?: unknown }).cause
  }

  return false
}

export async function getUserById(id: number): Promise<{
  success: boolean
  data?: ServerUser
  error?: string
  dbUnavailable?: boolean
}> {
  try {
    const user = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .then((res) => res[0])

    if (!user) {
      return { success: false, error: "User not found" }
    }
    return { success: true, data: user }
  } catch (error) {
    console.error("❌ Error fetching user:", error)
    return {
      success: false,
      error: "Failed to fetch user",
      dbUnavailable: isDbUnavailableError(error),
    }
  }
}