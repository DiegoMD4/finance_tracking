"use server"

import { bankAccountSchema } from "@/app/bank-accounts/schema"
import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import {
  CreateBankAccount,
  ErrorsCreateBankAccount,
  GetBankAccounts,
} from "@/types/bank-accounts.types"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"

type ActionState =
  | { success: boolean; message: string; error?: ErrorsCreateBankAccount }
  | null
  | undefined

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
export const createBankAccount = async (
  prevState: ActionState,
  formData: FormData
): Promise<CreateBankAccount | undefined> => {
  console.log(prevState)
  const rawFields = {
    bankName: formData.get("bankName")?.toString() || "",
    accountNumber: formData.get("accountNumber")?.toString() || "",
    bankAccountType: formData.get("bankAccountType")?.toString() || "",
    accountCurrency: formData.get("currency")?.toString() || "",
    accountEmail: formData.get("email")?.toString() || "",
  }

  const validatedFields = bankAccountSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        accountNumber: fieldErrors.properties?.accountNumber?.errors[0],
        bankName: fieldErrors.properties?.bankName?.errors[0],
        bankAccountType: fieldErrors.properties?.bankAccountType?.errors[0],
        accountCurrency: fieldErrors.properties?.accountCurrency?.errors[0],
        accountEmail: fieldErrors.properties?.accountEmail?.errors[0]
      },
      fields: rawFields,
    }
  }
  const { bankName, accountNumber, bankAccountType, accountCurrency, accountEmail } = validatedFields.data
  try {
    await db.insert(bankAccounts).values({
      accountNumber: accountNumber!,
      bankName: bankName!,
      bankAccountType: bankAccountType!,
      accountCurrency,
      accountEmail,
      userId: 1,
    })

    revalidatePath("/bank-accounts")
    return {
      success: true,
      message: "New bank account added successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error creating new bank account:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
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
