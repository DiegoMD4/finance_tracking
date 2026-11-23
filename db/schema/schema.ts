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
  int,
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

/**
 * Una fila por **evento** de importación masiva (no por documento).
 *
 * La huella (`file_hash` + `account_id`) responde "¿ya cargué este archivo?";
 * el lote en sí es lo que permite deshacer una carga concreta sin tocar las
 * anteriores. Las filas creadas manualmente quedan sin lote (`NULL`).
 */
export const importBatches = mysqlTable(
  "import_batches",
  {
    id: serial("import_batch_id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: bigint("account_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => bankAccounts.id),
    /**
     * SHA-256 (hex) del contenido binario del archivo. `NULL` si el cliente no
     * pudo calcularlo (contexto no seguro, error de lectura): en ese caso la
     * carga funciona igual, pero no hay aviso de "archivo ya importado".
     */
    fileHash: varchar("file_hash", { length: 64 }),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: int("file_size", { unsigned: true }),
    /** `csv` | `excel` | `pdf` | `unknown` según el parser. */
    sourceFormat: varchar("source_format", { length: 16 }),
    /** Filas enviadas por el cliente (incluye duplicadas y fallidas). */
    rowCount: int("row_count", { unsigned: true }).notNull().default(0),
    savedCount: int("saved_count", { unsigned: true }).notNull().default(0),
    skippedCount: int("skipped_count", { unsigned: true }).notNull().default(0),
    failedCount: int("failed_count", { unsigned: true }).notNull().default(0),
    /** Se completa al deshacer la importación; el lote no se borra. */
    undoneAt: timestamp("undone_at"),
    ...timestamps,
  },
  (table) => [
    // Aviso "este archivo ya se importó" (y aislamiento por cuenta).
    index("import_batches_lookup_idx").on(
      table.accountId,
      table.fileHash,
      table.createdAt
    ),
    // Historial de importaciones del usuario.
    index("import_batches_user_idx").on(table.userId, table.createdAt),
  ]
)

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
  /**
   * Lote de importación que creó la fila. `NULL` en filas manuales o
   * históricas; `SET NULL` si el lote desaparece.
   */
  importBatchId: bigint("import_batch_id", { mode: "number", unsigned: true })
    .references(() => importBatches.id, { onDelete: "set null" }),
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
  // Deshacer una importación borra por lote.
  index("transactions_import_batch_idx").on(table.importBatchId),
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
