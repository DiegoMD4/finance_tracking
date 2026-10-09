import { test, expect } from "@playwright/test"
import { truncateDatabase } from "@/tests/setup/db"
import { db } from "@/db"
import { users, bankAccounts, categories } from "@/db/schema/schema"
import { SignJWT } from "jose"

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

async function sessionToken(userId: number) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret())
}

let userId: number

test.beforeAll(async () => {
  await truncateDatabase()
  const [user] = await db
    .insert(users)
    .values({
      name: "E2E",
      email: "e2e@test.com",
      password: "x",
    })
    .$returningId()
  userId = user.id
  await db.insert(bankAccounts).values({
    accountNumber: "0001",
    bankName: "Test Bank",
    userId,
  })
  await db.insert(categories).values({ name: "Food", userId })
})

test("register a transactions and appears in the list", async ({
  page,
  context,
}) => {
  const token = await sessionToken(userId)
  await context.addCookies([
    {
      name: "session",
      value: token,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
      /*   path: "/", */
    },
  ])
  await page.goto("/transactions")
  await expect(
    page.getByRole("heading", { name: "Transactions" })
  ).toBeVisible()

  await page.getByRole("link", { name: /new transaction/i }).click()

  //llenado del form
  await page.getByLabel("Bank account").click()
  await page.getByRole("option", { name: /Test Bank/ }).click()
  await page.getByLabel("Transaction type").click()
  await page.getByRole("option", { name: "Income" }).click()

  await page.getByLabel("Amount").fill("25.50")

  await page.getByLabel("Transaction category").click()
  await page.getByRole("option", { name: "Food" }).click()
  await page.getByLabel("Description").fill("e2e test")

  await page.getByRole("button", { name: "Submit" }).click()
  await expect(
    page.getByRole("heading", { name: "Transactions" })
  ).toBeVisible()

  await expect(page.getByRole("cell", { name: "L. 25.50" })).toBeVisible()

  await expect(page.getByRole("cell", { name: "e2e test" })).toBeVisible()
})
