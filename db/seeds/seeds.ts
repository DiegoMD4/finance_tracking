import { drizzle } from "drizzle-orm/mysql2"
import { isNull, sql } from "drizzle-orm"
import mysql from "mysql2/promise"
import { categories, users } from "../schema/schema"
import "dotenv/config"

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
})

const db = drizzle(connection)

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

async function seedDemoUser() {
  console.log("🌱 Sembrando usuario de prueba...")

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
}

async function seedCategories() {
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(categories)
    .where(isNull(categories.userId))

  if (Number(count) > 0) {
    console.log("↪️ Ya existen categorias globales, se omite el seed.")
    return
  }

  console.log("🌱 Sembrando categorias generales...")

  for (const category of GENERAL_CATEGORIES) {
    await db.insert(categories).values({
      name: category.name,
      icon: category.icon,
      color: category.color,
      userId: null, // 👈 Al dejarlo null, se vuelve global
    })
  }

  console.log("✅ Categorias generales sembradas con éxito!")
}

async function main() {
  console.log("⚙️ Conectando a la base de datos...")

  await seedDemoUser()
  await seedCategories()

  await connection.end()
  console.log("👋 Proceso terminado con éxito.")
}

main().catch((err) => {
  console.error("❌ Error durante el proceso:", err)
  process.exit(1)
})
