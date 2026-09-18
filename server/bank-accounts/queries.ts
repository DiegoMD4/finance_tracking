import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { GetBankAccountById, GetBankAccounts } from "@/types/bank-accounts.types"
import { desc } from "drizzle-orm"

export const getBankAccounts = async (): Promise<GetBankAccounts> => {
  try {
    const res = await db.select().from(bankAccounts)

    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: [],
      error: "Couldn't get your bank accounts try it later",
    }
  }
}

export const getBankAccountsPaginated = async (
  page = 1,
  pageSize = 5
): Promise<GetBankAccounts> => {
  try {
    const res = await db
      .select()
      .from(bankAccounts)
      .orderBy(desc(bankAccounts.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize)

    const hasMore = res.length > pageSize
    const dataToReturn = hasMore ? res.slice(0, pageSize) : res

    return {
      success: true,
      data: dataToReturn,
      hasMore,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: [],
      error: "Couldn't get your bank accounts try it later",
    }
  }
}
export const getBankAccountById = async ({
  id,
}: {
  id: number
}): Promise<GetBankAccountById> => {
  try {
    const res = await db.query.bankAccounts.findFirst({
      where: (bankAccounts, { eq }) => eq(bankAccounts.id, id),
    })

    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error: ", error)

    return {
      success: false,
      data: undefined,
      error: "Couldn't get your bank accounts try it later",
    }
  }
}