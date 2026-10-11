import { SignJWT } from "jose"
import type { BrowserContext } from "@playwright/test"

export const SESSION_COOKIE_NAME = "session"

export function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function sessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret())
}

export async function addSessionCookie(
  context: BrowserContext,
  token: string,
  url = "http://localhost:3000"
): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url,
      httpOnly: true,
      sameSite: "Lax",
      /*   path: "/", */
    },
  ])
}