"use server"

import { transactionSchema } from "@/app/transactions/schema"
import { db } from "@/db"
import { transactions } from "@/db/schema/schema"
import {
  TransactionsActionState,
  CreateTransaction,
  UpdateTransaction,
} from "@/types/transactions.types"

import { and, eq, gte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import z from "zod"

export const createTransaction = async (
  prevState: TransactionsActionState,
  formData: FormData
): Promise<CreateTransaction | undefined> => {
  const rawFields = {
    userId: formData.get("userId")?.toString() || "",
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    source: formData.get("source")?.toString() || "",
  }

  const validatedFields = transactionSchema.safeParse(rawFields)

  if (!validatedFields.success) {
    const fieldErrors = z.treeifyError(validatedFields.error)
    return {
      success: false,
      message: "Invalid form data",
      error: {
        userId: fieldErrors.properties?.userId?.errors[0],
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
        source: fieldErrors.properties?.source?.errors[0],
      },
      fields: rawFields,
    }
  }

  const {
    userId,
    accountId,
    amount,
    transactionType,
    transactionDescription,
    source,
  } = validatedFields.data

  try {
    await db.insert(transactions).values({
      userId,
      accountId,
      amount,
      transactionType,
      transactionDescription,
      source,
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
  try {
    await db.delete(transactions).where(eq(transactions.id, id))
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
    userId: formData.get("userId")?.toString() || "",
    accountId: formData.get("accountId")?.toString() || "",
    amount: formData.get("amount")?.toString() || "",
    transactionType: formData.get("transactionType")?.toString() || "",
    transactionDescription:
      formData.get("transactionDescription")?.toString() || "",
    source: formData.get("source")?.toString() || "",
  }

  if (!transactionId || isNaN(transactionId)) {
    return {
      success: false,
      message: "Missing or invalid transaction ID",
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
        userId: fieldErrors.properties?.userId?.errors[0],
        accountId: fieldErrors.properties?.accountId?.errors[0],
        amount: fieldErrors.properties?.amount?.errors[0],
        transactionType: fieldErrors.properties?.transactionType?.errors[0],
        transactionDescription:
          fieldErrors.properties?.transactionDescription?.errors[0],
        source: fieldErrors.properties?.source?.errors[0],
      },
      fields: rawFields,
    }
  }

  const {
    userId,
    accountId,
    amount,
    transactionType,
    transactionDescription,
    source,
  } = validatedFields.data

  try {
    await db
      .update(transactions)
      .set({
        userId,
        accountId,
        amount,
        transactionType,
        transactionDescription,
        source,
      })
      .where(eq(transactions.id, transactionId))

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

export async function getMonthlyFinancials(userId: number) {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const rows = await db
    .select({
      monthNumber: sql<number>`MONTH(${transactions.createdAt})`,
      month: sql<string>`MONTHNAME(${transactions.createdAt})`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.createdAt, sixMonthsAgo)
      )
    )
    .groupBy(
      sql`MONTH(${transactions.createdAt})`,
      sql`MONTHNAME(${transactions.createdAt})`
    )
    .orderBy(sql`MONTH(${transactions.createdAt})`)

  return rows.map((row) => ({
    ...row,
    income: Number(row.income),
    expense: Number(row.expense),
  }))
}

