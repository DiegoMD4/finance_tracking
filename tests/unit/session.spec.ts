import { beforeEach, describe, expect, it, vi } from "vitest"

// No mockeamos @/lib/jwt: probamos las funciones reales.
// Mockeamos sus dependencias externas: next/headers (cookies) y jose (jwtVerify).
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}))

vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
  SignJWT: vi.fn().mockReturnValue({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-token"),
  }),
}))

vi.mock("@/server/users/queries", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/server/users/queries")
  >()
  return { ...actual, getUserById: vi.fn() }
})

import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import {
  getCurrentUserId,
  getSessionUserId,
  hasSessionCookie,
  requireUserId,
  verifySessionToken,
} from "@/lib/jwt"
import { getUserById, isDbUnavailableError } from "@/server/users/queries"
import { getSessionUserInfo } from "@/server/session"

const mockCookies = vi.mocked(cookies)
const mockJwtVerify = vi.mocked(jwtVerify)
const mockGetUserById = vi.mocked(getUserById)

const user = {
  id: 1,
  name: "Ana",
  email: "ana@test.com",
  defaultCurrency: "HNL",
}

beforeEach(() => {
  mockCookies.mockReset()
  mockJwtVerify.mockReset()
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
    // Dado: no existe cookie de sesión
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    // Entonces: retorna no-token y no consulta getUserById
    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "no-token",
    })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it("returns bad-token when the cookie exists but the token is invalid", async () => {
    // Dado: existe cookie pero el token no se puede verificar
    mockCookies.mockResolvedValue({
      get: () => ({ name: "session", value: "bad-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    mockJwtVerify.mockRejectedValue(new Error("Invalid token"))

    // Entonces: retorna bad-token y no consulta getUserById
    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "bad-token",
    })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it("returns authenticated with the user", async () => {
    // Dado: cookie válida y usuario existe en BD
    mockCookies.mockResolvedValue({
      get: () => ({ name: "session", value: "valid-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    mockJwtVerify.mockResolvedValue(
      {
        payload: { userId: 1 },
        protectedHeader: { alg: "HS256" },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>
    )
    mockGetUserById.mockResolvedValue({ success: true, data: user })

    // Entonces: retorna autenticado con el usuario
    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "authenticated",
      user,
    })
  })

  it("returns user-not-found when the user was deleted", async () => {
    // Dado: cookie válida pero el usuario no existe en BD
    mockCookies.mockResolvedValue({
      get: () => ({ name: "session", value: "valid-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    mockJwtVerify.mockResolvedValue(
      {
        payload: { userId: 99 },
        protectedHeader: { alg: "HS256" },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>
    )
    mockGetUserById.mockResolvedValue({
      success: false,
      error: "User not found",
    })

    // Entonces: retorna user-not-found
    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "unauthenticated",
      reason: "user-not-found",
    })
  })

  it("returns db-unavailable when the database is unreachable", async () => {
    // Dado: cookie válida pero la base de datos está caída
    mockCookies.mockResolvedValue({
      get: () => ({ name: "session", value: "valid-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    mockJwtVerify.mockResolvedValue(
      {
        payload: { userId: 1 },
        protectedHeader: { alg: "HS256" },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>
    )
    mockGetUserById.mockResolvedValue({
      success: false,
      error: "Failed to fetch user",
      dbUnavailable: true,
    })

    // Entonces: retorna db-unavailable
    await expect(getSessionUserInfo()).resolves.toEqual({
      status: "db-unavailable",
    })
  })
})

describe("getSessionUserId", () => {
  it("S-01: returns userId when there is a valid cookie session", async () => {
    // Dado: cookie de sesión válida y token verificable
    mockCookies.mockResolvedValue(
      {
        get: () => ({ name: "session", value: "valid-token" }),
        has: () => true,
        size: 1,
        getAll: () => [{ name: "session", value: "valid-token" }],
        [Symbol.iterator]: function* () {},
      } as unknown as Awaited<ReturnType<typeof cookies>>
    )
    mockJwtVerify.mockResolvedValue(
      {
        payload: { userId: 1 },
        protectedHeader: { alg: "HS256" },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>
    )

    // Cuando: se obtiene el userId de la sesión
    const result = await getSessionUserId()

    // Entonces: retorna el userId numérico
    expect(result).toBe(1)
  })

  it("S-02: returns null when there is no session cookie", async () => {
    // Dado: no existe cookie de sesión
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    // Cuando: se obtiene el userId de la sesión
    const result = await getSessionUserId()

    // Entonces: retorna null (no lanza error)
    expect(result).toBeNull()
  })

  it("S-03: returns null when the token is invalid (malformed cookie)", async () => {
    // Dado: existe cookie pero el token es inválido
    mockCookies.mockResolvedValue({
      get: () => ({ name: "session", value: "malformed-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    mockJwtVerify.mockRejectedValue(new Error("Invalid token"))

    // Cuando: se obtiene el userId de la sesión
    const result = await getSessionUserId()

    // Entonces: retorna null (captura el error internamente, no lanza)
    expect(result).toBeNull()
  })

  it("S-04: requireUserId throws Unauthorized error when there is no session", async () => {
    // Dado: no hay sesión (no hay cookie válida)
    mockCookies.mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    // Cuando: se llama a requireUserId
    // Entonces: lanza un error indicando que se requiere sesión válida
    await expect(requireUserId()).rejects.toThrow(
      "Unauthorized: a valid session is required"
    )
  })
})

describe("verifySessionToken", () => {
  it("S-05: validates a correct JWT token and returns { userId }", async () => {
    // Dado: token JWT válido
    mockJwtVerify.mockResolvedValue(
      {
        payload: { userId: 1 },
        protectedHeader: { alg: "HS256" },
      } as unknown as Awaited<ReturnType<typeof jwtVerify>>
    )

    // Cuando: se verifica el token
    const result = await verifySessionToken("valid-token")

    // Entonces: retorna el objeto con userId
    expect(result).toEqual({ userId: 1 })
    expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", expect.anything())
  })

  it("S-06: returns null when the token is corrupt/invalid", async () => {
    // Dado: token corrupto que hace fallar jwtVerify
    mockJwtVerify.mockRejectedValue(new Error("Invalid token"))

    // Cuando: se verifica el token corrupto
    const result = await verifySessionToken("basura")

    // Entonces: retorna null (captura el error internamente)
    expect(result).toBeNull()
  })
})

describe("hasSessionCookie", () => {
  it("S-07: returns true when a session cookie exists", async () => {
    // Dado: existe una cookie de sesión
    mockCookies.mockResolvedValue(
      {
        get: () => ({ name: "session", value: "some-token" }),
        has: () => true,
        size: 1,
        getAll: () => [{ name: "session", value: "some-token" }],
        [Symbol.iterator]: function* () {},
      } as unknown as Awaited<ReturnType<typeof cookies>>
    )

    // Cuando: se verifica si existe cookie de sesión
    const result = await hasSessionCookie()

    // Entonces: retorna true
    expect(result).toBe(true)
  })

  it("S-08: returns false when there is no session cookie", async () => {
    // Dado: no existe cookie de sesión (get devuelve undefined)
    mockCookies.mockResolvedValue(
      {
        get: () => undefined,
        has: () => false,
        size: 0,
        getAll: () => [],
        [Symbol.iterator]: function* () {},
      } as unknown as Awaited<ReturnType<typeof cookies>>
    )

    // Cuando: se verifica si existe cookie de sesión
    const result = await hasSessionCookie()

    // Entonces: retorna false
    expect(result).toBe(false)
  })
})
