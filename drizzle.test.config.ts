import { defineConfig } from "drizzle-kit"
import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

if (!existsSync(".env.test.local")) {
  throw new Error(".env.test.local is missing")
}

delete process.env.DATABASE_URL
loadEnvFile(".env.test.local")

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL
}

const DATABASE_URL = getDatabaseUrl()

if (!DATABASE_URL?.includes("test")) {
  throw new Error(
    "DATABASE_URL no apunta a una base de test: debe contener 'test'."
  )
}

export default defineConfig({
  schema: "./db/schema/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: DATABASE_URL,
  },
})