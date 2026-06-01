import { drizzle } from "drizzle-orm/mysql2"
/* import { migrate } from "drizzle-orm/mysql2/migrator" // 👈 Importante para migrar desde código */
import mysql from "mysql2/promise"
import { users } from "../schema/schema"
import "dotenv/config"

async function main() {
  console.log("⚙️ Conectando a la base de datos...")

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
  })

  const db = drizzle(connection)

  console.log("⚙️ Verificando y ejecutando migraciones pendientes...")

 /*  await migrate(db, { migrationsFolder: "./drizzle" }) */

  console.log("🌱 Sembrando datos de prueba...")
  await db
    .insert(users)
    .values({
      name: "Demo User",
      email: "demo@example.com",
      passowrd: "1234",
    })
    .onDuplicateKeyUpdate({
      set: { name: "Demo User" },
    })

  console.log("✅ ¡Usuario demo creado o actualizado con éxito!")

  await connection.end()
  console.log("👋 Proceso terminado con éxito.")
}

main().catch((err) => {
  console.error("❌ Error durante el proceso:", err)
  process.exit(1)
})
