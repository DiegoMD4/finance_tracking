import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/jwt", () => ({
  getCurrentUserId: vi.fn(),
  hasSessionCookie: vi.fn(),
}))

vi.mock("@/server/users/queries", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/server/users/queries")
  >()
  return { ...actual, getUserById: vi.fn() }
})

import { getCurrentUserId, hasSessionCookie } from "@/lib/jwt"
import { getUserById, isDbUnavailableError } from "@/server/users/queries"
import { getSessionUserInfo } from "@/server/session"

const mockGetCurrentUserId = vi.mocked(getCurrentUserId)
const mockHasSessionCookie = vi.mocked(hasSessionCookie)
const mockGetUserById = vi.mocked(getUserById)

const user = { id: 1, name: "Ana", email: "ana@test.com", defaultCurrency: "HNL" }

beforeEach(() => {
  mockGetCurrentUserId.mockReset()
  mockHasSessionCookie.mockReset()
  mockGetUserById.mockReset()
})

describe("isDbUnavailableError", () => {
  it.each([
    ["ECONNREFUSED", { code: "ECONNREFUSED" }, true],
    ["ECONNRESET", { code: "ECONNRESET" }, true],
    ["ETIMEDOUT", { code: "ETIMEDOUT" }, true],
    ["PROTOCOL_CONNECTION_LOST", { code: "PROTOCOL_CONNECTION_LOST" }, true],
    ["POOL_CLOSED", { code: "POOL_CLOSED" }, true],
    ["errno -4078", { errno: -4078 }, true],
    ["errno -4037", { errno: -4037 }, true],
    [
      "message 'Can't reach database server'",
      { message: "Can't reach database server" },
      true,
    ],
    [
      "message 'Connection lost'",
      { message: "Connection lost: the server closed the connection." },
      true,
    ],
    [
      "drizzle wrapper with ECONNREFUSED on cause",
      new Error("Failed query: select ...", {
        cause: { code: "ECONNREFUSED", errno: -4078 },
      }),
      true,
    ],
    [
      "deep cause chain with ETIMEDOUT",
      new Error("outer", {
        cause: new Error("inner", {
          cause: { code: "ETIMEDOUT", errno: -4037 },
        }),
      }),
      true,
    ],
    [
      "drizzle wrapper with generic cause",
      new Error("Failed query: select ...", {
        cause: new Error("ER_NO_SUCH_TABLE"),
      }),
      false,
    ],
    ["ER_NO_SUCH_TABLE", { code: "ER_NO_SUCH_TABLE" }, false],
    ["generic error", new Error("boom"), false],
    ["null", null, false],
    ["undefined", undefined, false],
  ] as const)("returns %s", (_name, error, expected) => {
    expect(isDbUnavailableError(error as unknown)).toBe(expected)
  })
})

describe("getSessionUserInfo", () => {
  it("returns no-token when there is no session cookie", async () => {
    mockHasSessionCookie.mockResolvedValue(false)
    mockGetCurrentUserId.mockResolvedValue(null)

    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "no-token",
    })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it("returns bad-token when the cookie exists but the token is invalid", async () => {
    mockHasSessionCookie.mockResolvedValue(true)
    mockGetCurrentUserId.mockResolvedValue(null)

    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "bad-token",
    })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it("returns authenticated with the user", async () => {
    mockHasSessionCookie.mockResolvedValue(true)
    mockGetCurrentUserId.mockResolvedValue(user.id)
    mockGetUserById.mockResolvedValue({ success: true, data: user })

    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "authenticated",
      user,
    })
  })

  it("returns user-not-found when the user was deleted", async () => {
    mockHasSessionCookie.mockResolvedValue(true)
    mockGetCurrentUserId.mockResolvedValue(99)
    mockGetUserById.mockResolvedValue({ success: false, error: "User not found" })

    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "user-not-found",
    })
  })

  it("returns db-unavailable when the database is unreachable", async () => {
    mockHasSessionCookie.mockResolvedValue(true)
    mockGetCurrentUserId.mockResolvedValue(user.id)
    mockGetUserById.mockResolvedValue({
      success: false,
      error: "Failed to fetch user",
      dbUnavailable: true,
    })

    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "db-unavailable",
    })
  })
})