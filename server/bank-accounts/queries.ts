import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { err, ok, type Paginated, type Result } from "@/types/result"
import { and, desc, eq } from "drizzle-orm"
import { getSessionUserId } from "@/lib/jwt"
import type { BankAccounts } from "@/types/bank-accounts.types"

export const getBankAccounts = async (): Promise<Result<BankAccounts[]>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))

    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get your bank accounts try it later")
  }
}

export const getBankAccountsPaginated = async (
  page = 1,
  pageSize = 5
): Promise<Result<Paginated<BankAccounts>>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))
      .orderBy(desc(bankAccounts.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize)

    const hasMore = res.length > pageSize
    const items = hasMore ? res.slice(0, pageSize) : res

    return ok({ items, hasMore })
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get your bank accounts try it later")
  }
}

export const getBankAccountById = async ({
  id,
}: {
  id: number
}): Promise<Result<BankAccounts>> => {
  const userId = await getSessionUserId()
  if (!userId) {
    return err("unauthorized", "A valid session is required")
  }

  try {
    const res = await db.query.bankAccounts.findFirst({
      where: (bankAccounts, { and, eq }) =>
        and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)),
    })

    if (!res) {
      return err("not_found", "Bank account not found")
    }

    return ok(res)
  } catch (error) {
    console.error("❌ Error: ", error)

    return err("database", "Couldn't get your bank accounts try it later")
  }
}