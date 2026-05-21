"use server"

import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { GetBankAccounts } from "@/types/bank-accounts.types"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type ActionState = { success: boolean; message: string } | null | undefined

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
      error: "Couldn't get your bank accounts try it later",
    }
  }
}
export const createBankAccount = async (
  prevState: ActionState,
  formData: FormData
): Promise<{ success: boolean; message: string } | undefined> => {
  const accountNumber = formData.get("accountNumber")?.toString()
  const bankName = formData.get("bankName")?.toString()

  try {
    await db.insert(bankAccounts).values({
      accountNumber: accountNumber ?? "",
      bankName: bankName ?? "",
      userId: 1,
    })

    revalidatePath("/bank-accounts")
    return { success: true, message: "New bank account added successfully" }
  } catch (error) {
    console.error("❌ Error creating new bank account:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage }
  }
}

export const deleteBankAccount = async (id: number) => {
  try {
    const res = await db.delete(bankAccounts).where(eq(bankAccounts.id, id))
    console.log(res)
    revalidatePath("/bank-accounts")
    return { success: true, message: "Bank account deleted" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return { success: false, message: errorMessage }
  }
}
