"use server"

import { bankAccountSchema } from "@/app/(app)/bank-accounts/schema"
import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import {
  BankAccountActionState,
  CreateBankAccount,
  UpdateBankAccount,
} from "@/types/bank-accounts.types"
import { eq, or, and, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"
import { getSessionUserId } from "@/lib/jwt"

export const createBankAccount = async (
  prevState: BankAccountActionState,
  formData: FormData
): Promise<CreateBankAccount | undefined> => {
  const rawFields = {
    bankName: formData.get("bankName")?.toString() || "",
    accountNumber: formData.get("accountNumber")?.toString() || "",
    bankAccountType: formData.get("bankAccountType")?.toString() || "",
    accountCurrency: formData.get("currency")?.toString() || "",
    accountEmail: formData.get("email")?.toString() || "",
    openingBalance: formData.get("openingBalance")?.toString() || "",
    accountName: formData.get("accountName")?.toString() || "",
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      fields: rawFields,
    }
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
        accountEmail: fieldErrors.properties?.accountEmail?.errors[0],
        openingBalance: fieldErrors.properties?.openingBalance?.errors[0],
        accountName: fieldErrors.properties?.accountName?.errors[0],
      },
      fields: rawFields,
    }
  }
  const {
    bankName,
    accountNumber,
    bankAccountType,
    accountCurrency,
    accountEmail,
    openingBalance,
    accountName,
  } = validatedFields.data

  const integrityCheck = await checkDuplicateAccount({
    accountNumber,
    accountName,
    userId,
  })
  if (integrityCheck.isDuplicate) {
    return {
      success: false,
      message: "Validation error",
      error: integrityCheck.errors,
      fields: rawFields,
    }
  }

  try {
    await db.insert(bankAccounts).values({
      accountNumber: accountNumber!,
      bankName: bankName!,
      bankAccountType: bankAccountType!,
      accountCurrency,
      accountEmail,
      openingBalance: openingBalance.toString(),
      accountName,
      userId,
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
  const userId = await getSessionUserId()
  if (!userId) {
    return { success: false, message: "Unauthorized: a valid session is required" }
  }

  try {
    await db
      .delete(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))

    revalidatePath("/bank-accounts")
    return { success: true, message: "Bank account deleted" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return { success: false, message: errorMessage }
  }
}

export const updateBankAccount = async (
  prevState: BankAccountActionState,
  formData: FormData
): Promise<UpdateBankAccount | undefined> => {
  const idRaw = formData.get("id")?.toString()
  const bankAccountId = idRaw ? parseInt(idRaw, 10) : null
  const rawFields = {
    bankName: formData.get("bankName")?.toString() || "",
    accountNumber: formData.get("accountNumber")?.toString() || "",
    bankAccountType: formData.get("bankAccountType")?.toString() || "",
    accountCurrency: formData.get("currency")?.toString() || "",
    accountEmail: formData.get("email")?.toString() || "",
    openingBalance: formData.get("openingBalance")?.toString() || "",
    accountName: formData.get("accountName")?.toString() || "",
  }
  if (!bankAccountId || isNaN(bankAccountId)) {
    return {
      success: false,
      message: "Missing or invalid Bank Account ID",
      fields: rawFields,
    }
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      fields: rawFields,
    }
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
        accountEmail: fieldErrors.properties?.accountEmail?.errors[0],
        openingBalance: fieldErrors.properties?.openingBalance?.errors[0],
        accountName: fieldErrors.properties?.accountName?.errors[0],
      },
      fields: rawFields,
    }
  }

  const {
    bankName,
    accountNumber,
    bankAccountType,
    accountCurrency,
    accountEmail,
    openingBalance,
    accountName,
  } = validatedFields.data

  const integrityCheck = await checkDuplicateAccount({
    accountNumber,
    accountName,
    id: bankAccountId,
    userId,
  })
  if (integrityCheck.isDuplicate) {
    return {
      success: false,
      message: "Validation error",
      error: integrityCheck.errors,
      fields: rawFields,
    }
  }

  try {
    await db
      .update(bankAccounts)
      .set({
        accountNumber: accountNumber!,
        bankName: bankName!,
        bankAccountType: bankAccountType!,
        accountCurrency,
        accountEmail,
        openingBalance: openingBalance.toString(),
        accountName,
      })
      .where(
        and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.userId, userId))
      )

    revalidatePath("/bank-accounts")

    return {
      success: true,
      message: "Bank account updated successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("❌ Error updating bank account:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

interface ValidateDuplicateProps {
  accountNumber: string
  accountName: string
  id?: number | null
  userId: number
}

export async function checkDuplicateAccount({
  accountNumber,
  accountName,
  id,
  userId,
}: ValidateDuplicateProps) {
  let searchCondition = and(
    eq(bankAccounts.userId, userId),
    or(
      eq(bankAccounts.accountNumber, accountNumber),
      eq(bankAccounts.accountName, accountName)
    )
  )

  if (id) {
    searchCondition = and(searchCondition, ne(bankAccounts.id, id))
  }

  const existingAccount = await db
    .select()
    .from(bankAccounts)
    .where(searchCondition)
    .then((res) => res[0])

  if (existingAccount) {
    const errors: Record<string, string> = {}

    if (existingAccount.accountNumber === accountNumber) {
      errors.accountNumber = "This account number is already registered"
    }
    if (existingAccount.accountName === accountName) {
      errors.accountName =
        "You already have an account registered with this account name"
    }

    return { isDuplicate: true, errors }
  }

  return { isDuplicate: false, errors: {} }
}
