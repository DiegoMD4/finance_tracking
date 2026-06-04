import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { GetBankAccountById, GetBankAccounts } from "@/types/bank-accounts.types"

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