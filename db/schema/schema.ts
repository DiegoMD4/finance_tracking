import {
  mysqlTable,
  serial,
  varchar,
  decimal,
  timestamp,
  mysqlEnum,
  bigint,
} from "drizzle-orm/mysql-core"

const timestamps = {
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}


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

export const users = mysqlTable("users", {
  id: serial("user_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passowrd: varchar("password", {length: 255}).notNull().unique(),
  ...timestamps,
})

export const bankAccounts = mysqlTable("bank_accounts", {
  id: serial("account_id").primaryKey(),
  accountNumber: varchar("account_number", { length: 50 }).notNull().unique(),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  bankAccountType: varchar("bank_account_type", { length: 100 }).default(
    "Ahorros"
  ),
  userId: bigint("user_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
})
