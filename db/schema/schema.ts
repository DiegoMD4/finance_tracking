import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  bigint,
  decimal,
  int,
  mysqlEnum,
} from "drizzle-orm/mysql-core"

const timestamps = {
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}

export const users = mysqlTable("users", {
  id: serial("user_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passowrd: varchar("password", { length: 255 }).notNull().unique(),
  ...timestamps,
})

export const bankAccounts = mysqlTable("bank_accounts", {
  id: serial("account_id").primaryKey(),
  accountNumber: varchar("account_number", { length: 50 }).notNull().unique(),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  accountName: varchar("account_name", { length: 100 }),
  bankAccountType: varchar("bank_account_type", { length: 100 }).default(
    "savings"
  ),
  accountEmail: varchar("account_email", { length: 255 }),
  accountCurrency: varchar("account_currency", { length: 255 }),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  userId: bigint("user_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
})

export const transactions = mysqlTable("transactions", {
  id: serial("transaction_id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: bigint("account_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => bankAccounts.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  transactionType: mysqlEnum("transaction_type", [
    "income",
    "expense",
  ]).notNull(),
  transactionDescription: varchar("transaction_description", { length: 255 }),
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
