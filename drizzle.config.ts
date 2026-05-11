import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./db/schema/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})

console.log(process.env.DATABASE_URL)
