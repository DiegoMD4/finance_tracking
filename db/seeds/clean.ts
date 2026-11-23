import { drizzle } from "drizzle-orm/mysql2"
import { sql } from "drizzle-orm"
import mysql from "mysql2/promise"
import {
  transactions,
  importBatches,
  bankAccounts,
  categories,
  users,
} from "../schema/schema"
import "dotenv/config"

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
})

const db = drizzle(connection)

async function cleanDatabase() {
  console.log("🧹 Limpiando base de datos...\n")

  // Eliminar en orden inverso de dependencias (FKs)
  console.log("  🗑️  Eliminando transacciones...")
  await db.delete(transactions)
  console.log("  ✅ Transacciones eliminadas")

  // Debe ir antes de las cuentas: `fk_import_batches_account` no tiene
  // ON DELETE CASCADE, así que un lote bloquearía el borrado de la cuenta.
  console.log("  🗑️  Eliminando lotes de importación...")
  await db.delete(importBatches)
  console.log("  ✅ Lotes de importación eliminados")

  console.log("  🗑️  Eliminando cuentas bancarias...")
  await db.delete(bankAccounts)
  console.log("  ✅ Cuentas bancarias eliminadas")

  console.log("  🗑️  Eliminando categorías de usuario...")
  await db
    .delete(categories)
    .where(sql`${categories.userId} IS NOT NULL`)
  console.log("  ✅ Categorías de usuario eliminadas")

  console.log("  🗑️  Eliminando usuarios...")
  await db.delete(users)
  console.log("  ✅ Usuarios eliminados")
}

async function main() {
  console.log("⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos.\n")

  await cleanDatabase()

  console.log("\n🎉 ¡Base de datos limpiada!")
  console.log("   Ejecuta 'npm run db:seed' para recrear datos base.")

  await connection.end()
}

main().catch((err) => {
  console.error("❌ Error durante el proceso:", err)
  process.exit(1)
})
