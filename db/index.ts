import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema/schema"

const connection = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10, // Ajusta según los límites de tu plan en Railway
  queueLimit: 0,
})

export const db = drizzle({ client: connection, schema, mode: "default" })
