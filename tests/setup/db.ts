import { loadEnvFile } from "node:process"

export const TEST_DATABASE_MARKER = "test"

function loadTestEnv() {
  loadEnvFile(".env.test.local")
}

loadTestEnv()

if (!process.env.DATABASE_URL?.includes(TEST_DATABASE_MARKER)) {
  throw new Error(
    `Los tests requieren una base con '${TEST_DATABASE_MARKER}' en la URL.`
  )
}

const TABLES_IN_FK_ORDER = [
  "transactions",
  "bank_accounts",
  "categories",
  "users",
]

export async function truncateDatabase() {

  const { db } = await import("@/db")
  const { sql } = await import("drizzle-orm")
  for (const table of TABLES_IN_FK_ORDER) {
    await db.execute(sql.raw(`DELETE FROM ${table}`))
  }
}