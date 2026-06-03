import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema/schema"

// 1. Declaramos la variable global para TypeScript
const globalForDb = globalThis as unknown as {
  connection: mysql.Pool | undefined
}

// 2. Creamos la conexión REUTILIZANDO la global si ya existe
const connection =
  globalForDb.connection ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

// 3. En entorno de desarrollo, guardamos la conexión en el objeto global
if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection
}

// 4. Exportamos Drizzle normalmente utilizando la instancia única
export const db = drizzle({ client: connection, schema, mode: "default" })
