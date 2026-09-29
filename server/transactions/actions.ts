"use server"

import { transactionSchema } from "@/app/(app)/transactions/schema"
import { db } from "@/db"
import { transactions } from "@/db/schema/schema"
import { getDefaultCategory } from "@/server/categories/queries"
import {
  TransactionsActionState,
  CreateTransaction,
  UpdateTransaction,
} from "@/types/transactions.types"

import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"
import { getSessionUserId } from "@/lib/jwt"

const resolveCategoryId = async (rawCategoryId: string, userId: number) => {
  const parsedCategoryId = Number(rawCategoryId)

  if (parsedCategoryId) {
    return parsedCategoryId
  }

  const defaultCategory = await getDefaultCategory(userId)

  return defaultCategory.ok ? defaultCategory.data : parsedCategoryId
}

export const createTransaction = async (
  prevState: TransactionsActionState,
  formData: FormData
): Promise<CreateTransaction | undefined> => {
  const rawFields = {
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    categoryId: formData.get("categoryId")?.toString() || "",
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return {
      success: false,
      message: "Unauthorized: a valid session is required",
      fields: rawFields,
    }
  }

  const validatedFields = transactionSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
        /* categoryId: fieldErrors.properties?.categoryId?.errors[0], */
      },
      fields: rawFields,
    }
  }

  const { accountId, amount, transactionType, transactionDescription } =
    validatedFields.data

  try {
    await db.insert(transactions).values({
      userId,
      accountId,
      amount,
      transactionType,
      transactionDescription,
      categoryId: await resolveCategoryId(rawFields.categoryId, userId),
    })

    revalidatePath("/transactions")

    return {
      success: true,
      message: "Transaction created successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("Error creating transaction:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}

export const deleteTransaction = async (id: number) => {
  const userId = await getSessionUserId()
  if (!userId) {
    return { success: false, message: "Unauthorized: a valid session is required" }
  }

  try {
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    revalidatePath("/transactions")

    return { success: true, message: "Transaction deleted" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return { success: false, message: errorMessage }
  }
}

export const updateTransaction = async (
  prevState: TransactionsActionState,
  formData: FormData
): Promise<UpdateTransaction | undefined> => {
  const idRaw = formData.get("id")?.toString()
  const transactionId = idRaw ? parseInt(idRaw, 10) : null
  const rawFields = {
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    categoryId: formData.get("categoryId")?.toString() || "",
  }

  if (!transactionId || isNaN(transactionId)) {
    return {
      success: false,
      message: "Missing or invalid transaction ID",
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

  const validatedFields = transactionSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
      },
      fields: rawFields,
    }
  }

  const { accountId, amount, transactionType, transactionDescription } =
    validatedFields.data

  try {
    await db
      .update(transactions)
      .set({
        accountId,
        amount,
        transactionType,
        transactionDescription,
        categoryId: await resolveCategoryId(rawFields.categoryId, userId),
      })
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
      )

    revalidatePath("/transactions")

    return {
      success: true,
      message: "Transaction updated successfully",
      fields: rawFields,
    }
  } catch (error) {
    console.error("Error updating transaction:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    return { success: false, message: errorMessage, fields: rawFields }
  }
}
