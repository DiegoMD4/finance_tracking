import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema/schema" // Importamos tu esquema

const connection = mysql.createPool({
  uri: process.env.DATABASE_URL,
})

// Al pasarle el schema aquí, tendrás autocompletado total en tus consultas
export const db = drizzle(connection, { schema, mode: "default" })
