import { getCurrentUserId, hasSessionCookie } from "@/lib/jwt"
import { getUserById } from "@/server/users/queries"
import { ServerUser } from "@/types/users.types"

export type SessionUserInfo =
  | {
      status: "unauthenticated"
      reason: "no-token" | "bad-token" | "user-not-found"
    }
  | { status: "db-unavailable" }
  | { status: "authenticated"; user: ServerUser }

export async function getSessionUserInfo(): Promise<SessionUserInfo> {
  const hasCookie = await hasSessionCookie()
  const userId = await getCurrentUserId()

  if (!userId) {
    return {
      status: "unauthenticated",
      reason: hasCookie ? "bad-token" : "no-token",
    }
  }

  const result = await getUserById(userId)

  if (result.success && result.data) {
    return { status: "authenticated", user: result.data }
  }

  if (result.dbUnavailable) {
    return { status: "db-unavailable" }
  }

  return { status: "unauthenticated", reason: "user-not-found" }
}