"use server"

import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export const getBankAccounts = async () => {
  try {
    const res = await db.select().from(bankAccounts)

    // Retornamos un objeto estructurado que es más fácil de manejar en el cliente
    return {
      success: true,
      data: res,
    }
  } catch (error) {
    console.error("❌ Error al obtener las cuentas bancarias:", error)

    return {
      success: false,
      error: "No se pudieron cargar las cuentas bancarias. Inténtalo de nuevo.",
    }
  }
}
export const createBankAccount = async (formData: FormData) => {
  const accountNumber = formData.get("accountNumber")?.toString()
  const bankName = formData.get("bankName")?.toString()
  try {
    const res = await db.insert(bankAccounts).values({
      accountNumber: accountNumber ?? "",
      bankName: bankName ?? "",
      userId: 1,
    })

    // Retornamos un objeto estructurado que es más fácil de manejar en el cliente
    console.log({ success: true, data: res })
    revalidatePath("/bank-accounts")
  } catch (error) {
    console.error("❌ Error al crear la cuenta bancaria:", error)
  }
  redirect("/bank-accounts")
}

export const deleteBankAccount = async (id: number) => {
  try {
    const res = await db.delete(bankAccounts).where(eq(bankAccounts.id, id))

    revalidatePath("/bank-accounts")
    return { success: true, message: "Cuenta eliminada", res: res }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido"

    return { success: false, message: errorMessage }
  }
}
