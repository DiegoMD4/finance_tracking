import {
  mysqlTable,
  serial,
  varchar,
  timestamp,
  bigint,
  decimal,
  mysqlEnum,
  date,
  boolean,
  index,
  smallint,
  uniqueIndex,
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
  password: varchar("password", { length: 255 }).notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).default("HNL"),
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
  accountCurrency: varchar("account_currency", { length: 3 }),
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
  categoryId: bigint("category_id", { mode: "number", unsigned: true })
    .references(() => categories.categoryId)
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  transactionDate: date("transaction_date").notNull(),
  transactionCurrency: varchar("transaction_currency", { length: 3 })
    .notNull()
    .default("HNL"),
  bankReference: varchar("bank_reference", { length: 255 }),
  /**
   * Identidad congelada al importar una fila (SHA-256 en hex). `NULL` en filas
   * manuales o históricas: el índice único las ignora.
   */
  dedupeHash: varchar("dedupe_hash", { length: 64 }),
  /**
   * N-ésima copia de ese movimiento dentro del archivo de origen (1..n).
   * Se asigna al parsear y no se recalcula después.
   */
  dedupeOccurrence: smallint("dedupe_occurrence", { unsigned: true })
    .notNull()
    .default(1),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 })
    .notNull()
    .default("1.000000"),
  amountInDefaultCurrency: decimal("amount_in_default_currency", {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  defaultCurrencyAtTransaction: varchar("default_currency_at_transaction", {
    length: 3,
  })
    .notNull()
    .default("HNL"),
}, (table) => [
  // Una fila importada no puede repetirse: mismo movimiento + misma ocurrencia.
  // Las filas con `dedupe_hash NULL` (manuales/históricas) quedan fuera porque
  // MySQL permite múltiples NULL en un índice único.
  uniqueIndex("transactions_dedupe_unique").on(
    table.accountId,
    table.dedupeHash,
    table.dedupeOccurrence
  ),
  // Previsualización de duplicados "posibles" por fecha.
  index("transactions_account_date_idx").on(
    table.accountId,
    table.transactionDate
  ),
])

export const currencies = mysqlTable("currencies", {
  id: serial("currency_id").primaryKey(),
  code: varchar("code", { length: 3 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
})

export const categories = mysqlTable("categories", {
  categoryId: serial("category_id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).references(
    () => users.id
  ),
  name: varchar("name", { length: 256 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 7 }),
})
