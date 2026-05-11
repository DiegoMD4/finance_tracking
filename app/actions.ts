"use server"

import { db } from "@/db"
import { transactions } from "@/db/schema/schema"
import { revalidatePath } from "next/cache"

export async function createTestTransaction() {
  try {
    await db.insert(transactions).values({
      description: "Transacción de prueba",
      amount: "100.50", // Drizzle espera strings para tipos decimal para evitar pérdida de precisión
      category: "Food",
    })

    revalidatePath("/") // Limpia el caché de la página principal
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
