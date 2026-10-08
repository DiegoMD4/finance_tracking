import { db } from "@/db"
import {
  bankAccounts,
  categories,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { getSessionUserId } from "@/lib/jwt"
import { createTransaction } from "@/server/transactions/actions"

const session = vi.hoisted(() => ({ userId: 1 }))

vi.mock("@/lib/jwt.ts", () => ({
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(async () => {
  await truncateDatabase()
})

describe("CreateTransaction", () => {
  test("Create a transaction with valid data and returns success", async () => {
    const [user] = await db
      .insert(users)
      .values({
        name: "user",
        email: "user@user.com",
        password: "x",
      })
      .$returningId()
    session.userId = user.id

    const [account] = await db
      .insert(bankAccounts)
      .values({
        accountNumber: "0001",
        bankName: "Test Bank",
        userId: user.id,
      })
      .$returningId()
    const [category] = await db
      .insert(categories)
      .values({
        name: "Food",
        userId: user.id,
      })
      .$returningId()

    const formData = new FormData()
    formData.set("accountId", String(account.id))
    formData.set("categoryId", String(category.categoryId))
    formData.set("amount", "25.50")
    formData.set("transactionType", "expense")
    formData.set("transactionDescription", "Super")
    formData.set("transactionDate", "2026-01-10")

    const result = await createTransaction(null, formData)
    expect(result?.success).toBe(true)
    expect(result?.message).toBe("Transaction created successfully")

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe("25.50")
    expect(rows[0].transactionType).toBe("expense")
  })

  test("invalid amount returns error and doesnt persist", async () => {
    const formData = new FormData()
    formData.set("amount", "abc")
    formData.set("transactionType", "expense")
    formData.set("transactionDate", "2026-01-10")

    const result = await createTransaction(null, formData)
    expect(result?.success).toBe(false)
    expect(result?.error?.amount).toBeDefined()

    const rows = await db.select().from(transactions)
    expect(rows).toHaveLength(0)
  })
})
