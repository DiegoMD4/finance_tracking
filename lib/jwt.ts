import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

export const SESSION_COOKIE = "session"
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7 // 7 days

export type SessionPayload = {
  userId: number
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret())
}

export async function setSessionCookie(userId: number): Promise<void> {
  const token = await createSessionToken(userId)
  const cookie = await cookies()
  cookie.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookie = await cookies()
  cookie.delete(SESSION_COOKIE)
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return typeof payload.userId === "number"
      ? { userId: payload.userId }
      : null
  } catch {
    return null
  }
}

export async function getCurrentUserId(): Promise<number | null> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE)
  if (!sessionCookie) return null
  const session = await verifySessionToken(sessionCookie.value)
  return session?.userId ?? null
}

export async function requireUserId(): Promise<number> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error("Unauthorized: a valid session is required")
  }
  return userId
}

export async function getSessionUserId(): Promise<number | null> {
  try {
    return await requireUserId()
  } catch {
    return null
  }
}