import {
  mysqlTable,
  serial,
  varchar,
  decimal,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core"

// Definimos la tabla de transacciones
export const transactions = mysqlTable("transactions", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 255 }).notNull(),
  // Usamos decimal para precisión financiera (19 dígitos, 4 decimales)
  amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
  category: mysqlEnum("category", [
    "Food",
    "Rent",
    "Salary",
    "Transport",
    "Utilities",
  ]).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})
