import { expect, test } from "@playwright/test"
import { addSessionCookie, sessionToken } from "./helpers"

test("redirects to '/unavailable' while the database is down", async ({
  context,
  page,
}) => {
  const token = await sessionToken(1)
  await addSessionCookie(context, token, "http://localhost:3001")

  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/unavailable$/)
  await expect(
    page.getByRole("heading", { name: /unavailable/i })
  ).toBeVisible()
})

test("manual retry stays on maintenance while the database is down", async ({
  context,
  page,
}) => {
  const token = await sessionToken(1)
  await addSessionCookie(context, token, "http://localhost:3001")

  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/unavailable$/)

  await page.getByRole("button", { name: /try again/i }).click()

  await expect(page).toHaveURL(/\/unavailable$/)
})

test("logging out clears the cookie and returns to login", async ({
  context,
  page,
}) => {
  const token = await sessionToken(1)
  await addSessionCookie(context, token, "http://localhost:3001")

  await page.goto("/")
  await expect(page).toHaveURL(/\/unavailable$/)

  await page.getByRole("button", { name: /log out/i }).click()

  await expect(page).toHaveURL(/\/$/)
  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === "session")).toBeUndefined()
})