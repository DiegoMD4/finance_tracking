"use server"

import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"
import { GetBankAccounts } from "@/types/bank-accounts.types"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
type ActionState = { success: boolean; message: string } | null | undefined

export const getBankAccounts = async (): Promise<GetBankAccounts> => {
  try {
    const res = await db.select().from(bankAccounts)

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
    return { success: true, message: "Cuenta creada con éxito" }
  } catch (error) {
    console.error("❌ Error al crear la cuenta bancaria:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido"
    return { success: false, message: errorMessage }
  }
}

export const deleteBankAccount = async (id: number) => {
  try {
    const res = await db.delete(bankAccounts).where(eq(bankAccounts.id, id))
    console.log(res)
    revalidatePath("/bank-accounts")
    return { success: true, message: "Cuenta eliminada" }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido"

    return { success: false, message: errorMessage }
  }
}
