"use server"

import { db } from "@/db"
import { bankAccounts } from "@/db/schema/schema"

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
export const createBankAccount = async () => {
  try {
    const res = await db.insert(bankAccounts).values({
      accountNumber: "123456789",
      bankName: "Bank",
      userId: 1,
    })

    // Retornamos un objeto estructurado que es más fácil de manejar en el cliente
    console.log({ success: true, data: res })
  } catch (error) {
    console.error("❌ Error al crear la cuenta bancaria:", error)
  }
}
