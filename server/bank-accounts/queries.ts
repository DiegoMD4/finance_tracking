import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { err, ok, type Paginated, type Result } from "@/types/result"
import { desc } from "drizzle-orm"
import type { BankAccounts } from "@/types/bank-accounts.types"

export const getBankAccounts = async (): Promise<Result<BankAccounts[]>> => {
  try {
    const res = await db.select().from(bankAccounts)

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
  try {
    const res = await db
      .select()
      .from(bankAccounts)
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
  try {
    const res = await db.query.bankAccounts.findFirst({
      where: (bankAccounts, { eq }) => eq(bankAccounts.id, id),
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