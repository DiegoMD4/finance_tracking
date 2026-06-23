import { drizzle } from "drizzle-orm/mysql2"
/* import { migrate } from "drizzle-orm/mysql2/migrator" // 👈 Importante para migrar desde código */
import mysql from "mysql2/promise"
import { categories, users } from "../schema/schema"
import "dotenv/config"
 const connection = await mysql.createConnection({
   uri: process.env.DATABASE_URL,
 })

 const db = drizzle(connection)
async function main() {
  console.log("⚙️ Conectando a la base de datos...")

 

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



const GENERAL_CATEGORIES = [
  {
    name: "Housing & Utilities",
    icon: "home",
    color: "#3b82f6", // Blue
  },
  {
    name: "Food & Dining",
    icon: "utensils",
    color: "#f59e0b", // Amber
  },
  {
    name: "Transportation",
    icon: "car",
    color: "#10b981", // Emerald
  },
  {
    name: "Shopping & Entertainment",
    icon: "shopping-bag",
    color: "#ec4899", // Pink
  },
  {
    name: "Salary & Income",
    icon: "banknote",
    color: "#22c55e", // Green
  },
  {
    name: "Health & Medical",
    icon: "heart-pulse",
    color: "#ef4444", // Red
  },
  {
    name: "Education",
    icon: "graduation-cap",
    color: "#6366f1", // Indigo
  },
  {
    name: "Investments & Savings",
    icon: "trending-up",
    color: "#06b6d4", // Cyan
  },
  {
    name: "Miscellaneous / Others",
    icon: "circle-ellipsis",
    color: "#64748b", // Slate (Perfecta para la porción por defecto)
  },
]

async function seedCategories() {
  console.log("🌱 Seeding general categories...")

  for (const category of GENERAL_CATEGORIES) {
    await db.insert(categories).values({
      name: category.name,
      icon: category.icon,
      color: category.color,
      userId: null, // 👈 Al dejarlo null, se vuelve global
    })
  }

  console.log("✅ General categories seeded successfully!")
}

seedCategories().catch((err) => {
  console.error("❌ Error seeding categories:", err)
  process.exit(1)
})