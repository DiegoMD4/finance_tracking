import { beforeEach, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import {
  bankAccounts,
  categories,
  importBatches,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import {
  createBulkTransactions,
  undoImportBatch,
} from "@/server/transactions/actions"
import {
  getImportBatchStatus,
  getRecentImportBatches,
} from "@/server/transactions/queries"
import type { DedupeOriginal } from "@/lib/parsers/types"

const session = vi.hoisted(() => ({ userId: null as number | null }))

vi.mock("@/lib/jwt", () => ({
  getSessionUserId: async () => session.userId,
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/currency", () => ({
  getExchangeRate: vi.fn(async () => 1),
}))

// --- helpers ---------------------------------------------------------------

const HASH_A = "a".repeat(64)
const HASH_B = "b".repeat(64)

async function createTestUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ name: "Test User", email, password: "hashed" })
    .$returningId()

  return user.id
}

let accountSequence = 0

async function insertTestAccount(userId: number): Promise<number> {
  accountSequence += 1

  const [account] = await db
    .insert(bankAccounts)
    .values({
      accountNumber: `IMPORTS-${accountSequence}`,
      bankName: "Banco Test",
      accountName: "Cuenta Test",
      accountCurrency: "HNL",
      userId,
    })
    .$returningId()

  return account.id
}

async function insertTestCategory(userId: number): Promise<number> {
  const [category] = await db
    .insert(categories)
    .values({ name: DEFAULT_CATEGORY_NAME, userId })
    .$returningId()

  return category.categoryId
}

async function setup(email: string) {
  const userId = await createTestUser(email)
  session.userId = userId
  const accountId = await insertTestAccount(userId)
  const categoryId = await insertTestCategory(userId)

  return { userId, accountId, categoryId }
}

interface RowOptions {
  tempId?: string
  amount?: string
  date?: string
  reference?: string | null
  description?: string
  snapshot?: Partial<DedupeOriginal>
  occurrence?: number
}

function buildRow(index: number, options: RowOptions = {}): Record<string, unknown> {
  const {
    tempId = `temp-${index}`,
    amount = "10.00",
    date = "2026-01-10",
    reference = `REF-${index}`,
    description = "COMPRA POS",
    snapshot,
    occurrence = 1,
  } = options

  return {
    tempId,
    row: index + 1,
    amount,
    transactionType: "expense",
    transactionDescription: description,
    transactionDate: date,
    bankReference: reference,
    dedupe: {
      original: {
        date,
        amount,
        type: "expense",
        reference,
        description,
        currency: "HNL",
        ...snapshot,
      },
      occurrence,
    },
  }
}

interface FormDataOptions {
  accountId: number
  rows: unknown[]
  omitDuplicates?: boolean
  fingerprint?: string | null
  fileName?: string
  fileSize?: number
  sourceFormat?: string
}

function buildFormData({
  accountId,
  rows,
  omitDuplicates,
  fingerprint = HASH_A,
  fileName = "statement.xlsx",
  fileSize = 2048,
  sourceFormat = "excel",
}: FormDataOptions): FormData {
  const formData = new FormData()
  formData.set("accountId", String(accountId))
  formData.set("transactionsJson", JSON.stringify(rows))

  if (omitDuplicates !== undefined) {
    formData.set("omitDuplicates", omitDuplicates ? "true" : "false")
  }
  if (fingerprint !== null) formData.set("fileFingerprint", fingerprint)
  formData.set("fileName", fileName)
  formData.set("fileSize", String(fileSize))
  formData.set("sourceFormat", sourceFormat)

  return formData
}

const save = (options: FormDataOptions) =>
  createBulkTransactions(null, buildFormData(options))

const listBatches = (userId: number) =>
  db
    .select()
    .from(importBatches)
    .where(eq(importBatches.userId, userId))
    .orderBy(importBatches.id)

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  session.userId = null
})

// --- createBulkTransactions: lote -----------------------------------------

describe("createBulkTransactions: lote de importación", () => {
  it("IB-01: registra el lote y vincula las filas guardadas", async () => {
    // Dado: una importación de dos filas con huella
    const { userId, accountId } = await setup("imports01@test.com")
    const rows = [buildRow(0), buildRow(1)]

    // Cuando: se guarda
    const result = await save({ accountId, rows })
    expect(result?.saved).toBe(2)

    // Entonces: hay un lote con los conteos y el archivo
    const batches = await listBatches(userId)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toMatchObject({
      accountId,
      fileHash: HASH_A,
      fileName: "statement.xlsx",
      fileSize: 2048,
      sourceFormat: "excel",
      rowCount: 2,
      savedCount: 2,
      skippedCount: 0,
      failedCount: 0,
      undoneAt: null,
    })

    // Y: las dos transacciones apuntan a ese lote
    const savedRows = await db
      .select({ importBatchId: transactions.importBatchId })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
    expect(savedRows).toHaveLength(2)
    expect(savedRows.every((row) => row.importBatchId === batches[0].id)).toBe(
      true
    )
  })

  it("IB-02: el aviso de archivo repetido aísla cuenta y usuario", async () => {
    // Dado: un lote importado por el usuario A en su cuenta
    const { userId, accountId } = await setup("imports02@test.com")
    await save({ accountId, rows: [buildRow(0)] })

    // Entonces: se encuentra por (cuenta, huella)
    const found = await getImportBatchStatus({ accountId, fileHash: HASH_A })
    expect(found.ok).toBe(true)
    if (!found.ok) return
    expect(found.data?.savedCount).toBe(1)

    // Y: no se encuentra con otra huella ni con otra cuenta
    const otherHash = await getImportBatchStatus({
      accountId,
      fileHash: HASH_B,
    })
    expect(otherHash.ok && otherHash.data).toBeNull()

    const otherAccountId = await insertTestAccount(userId)
    const otherAccount = await getImportBatchStatus({
      accountId: otherAccountId,
      fileHash: HASH_A,
    })
    expect(otherAccount.ok && otherAccount.data).toBeNull()

    // Y: otro usuario no ve el lote
    const otherUserId = await createTestUser("imports02-other@test.com")
    session.userId = otherUserId
    const otherUser = await getImportBatchStatus({
      accountId,
      fileHash: HASH_A,
    })
    expect(otherUser.ok && otherUser.data).toBeNull()
  })

  it("IB-03: reimportar el mismo archivo no crea otro lote ni duplica filas", async () => {
    // Dado: un archivo ya importado
    const { userId, accountId } = await setup("imports03@test.com")
    const rows = [buildRow(0), buildRow(1)]
    await save({ accountId, rows })

    // Cuando: se vuelve a importar con el checkbox marcado
    const second = await save({ accountId, rows })

    // Entonces: todo se omite y no hay lote nuevo
    expect(second?.saved).toBe(0)
    expect(second?.skipped).toBe(2)
    expect(await listBatches(userId)).toHaveLength(1)

    const savedRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
    expect(savedRows).toHaveLength(2)
  })

  it("IB-04: sin el checkbox se guardan con la siguiente ocurrencia y lote nuevo", async () => {
    // Dado: un archivo ya importado
    const { userId, accountId } = await setup("imports04@test.com")
    const rows = [buildRow(0), buildRow(1)]
    await save({ accountId, rows })

    // Cuando: se reimporta desmarcando el checkbox
    const second = await save({ accountId, rows, omitDuplicates: false })
    expect(second?.saved).toBe(2)

    // Entonces: dos lotes y ocurrencias 2 y 3 por identidad
    const batches = await listBatches(userId)
    expect(batches).toHaveLength(2)
    expect(batches[1].savedCount).toBe(2)

    const savedRows = await db
      .select({
        reference: transactions.bankReference,
        occurrence: transactions.dedupeOccurrence,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))

    expect(savedRows).toHaveLength(4)
    const occurrences = savedRows
      .filter((row) => row.reference === "REF-0")
      .map((row) => row.occurrence)
      .sort((a, b) => a - b)
    expect(occurrences).toEqual([1, 2])
  })

  it("IB-09: sin huella o con huella inválida la importación funciona y el lote queda sin hash", async () => {
    // Dado: un cliente que no pudo calcular la huella
    const { userId, accountId } = await setup("imports09@test.com")

    // Cuando: se guarda sin fileFingerprint
    const result = await save({
      accountId,
      rows: [buildRow(0)],
      fingerprint: null,
    })

    // Entonces: se guarda igual y el lote no tiene huella
    expect(result?.saved).toBe(1)

    // Y: una huella con formato inválido se descarta en el servidor
    const invalid = await save({
      accountId,
      rows: [buildRow(1)],
      fingerprint: "not-a-sha256",
    })
    expect(invalid?.saved).toBe(1)

    const batches = await listBatches(userId)
    expect(batches).toHaveLength(2)
    expect(batches.every((batch) => batch.fileHash === null)).toBe(true)
  })
})

// --- undoImportBatch -------------------------------------------------------

describe("undoImportBatch", () => {
  it("IB-05: borra solo las filas del lote deshecho", async () => {
    // Dado: dos importaciones distintas en la misma cuenta
    const { userId, accountId } = await setup("undo05@test.com")
    const firstRows = [buildRow(0), buildRow(1)]
    const secondRows = [buildRow(2), buildRow(3)]

    await save({ accountId, rows: firstRows, fingerprint: HASH_A })
    await save({ accountId, rows: secondRows, fingerprint: HASH_B })

    const batches = await listBatches(userId)
    expect(batches).toHaveLength(2)

    // Cuando: se deshace la primera
    const result = await undoImportBatch(batches[0].id)
    expect(result.success).toBe(true)
    expect(result.deleted).toBe(2)

    // Entonces: quedan solo las filas de la segunda importación
    const remaining = await db
      .select({ reference: transactions.bankReference })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))

    expect(remaining.map((row) => row.reference).sort()).toEqual([
      "REF-2",
      "REF-3",
    ])

    // Y: el lote queda marcado como deshecho
    const [undoneBatch] = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batches[0].id))
    expect(undoneBatch.undoneAt).not.toBeNull()
  })

  it("IB-06: deshacer dos veces falla sin borrar más filas", async () => {
    // Dado: una importación ya deshecha
    const { userId, accountId } = await setup("undo06@test.com")
    await save({ accountId, rows: [buildRow(0), buildRow(1)] })
    const [batch] = await listBatches(userId)

    const first = await undoImportBatch(batch.id)
    expect(first.deleted).toBe(2)

    // Cuando: se intenta deshacer de nuevo
    const second = await undoImportBatch(batch.id)

    // Entonces: falla y no borra nada
    expect(second.success).toBe(false)
    expect(second.deleted).toBe(0)
    expect(second.message).toBe("This import was already undone")
  })

  it("IB-07: no se puede deshacer un lote de otro usuario", async () => {
    // Dado: un lote del usuario A
    const { userId, accountId } = await setup("undo07@test.com")
    await save({ accountId, rows: [buildRow(0)] })
    const [batch] = await listBatches(userId)

    // Cuando: lo intenta deshacer el usuario B
    const otherUserId = await createTestUser("undo07-other@test.com")
    session.userId = otherUserId
    const result = await undoImportBatch(batch.id)

    // Entonces: falla y la fila sigue ahí
    expect(result.success).toBe(false)
    expect(result.message).toBe("Import not found")

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
    expect(rows).toHaveLength(1)
  })

  it("IB-08: las filas manuales sobreviven al deshacer", async () => {
    // Dado: una importación y una fila manual en la misma cuenta
    const { userId, accountId, categoryId } = await setup("undo08@test.com")
    await save({ accountId, rows: [buildRow(0)] })
    const [batch] = await listBatches(userId)

    await db.insert(transactions).values({
      userId,
      accountId,
      amount: "99.00",
      transactionType: "expense",
      transactionDescription: "Manual",
      transactionDate: new Date("2026-01-15"),
      categoryId,
      transactionCurrency: "HNL",
      dedupeHash: null,
      dedupeOccurrence: 1,
      importBatchId: null,
    })

    // Cuando: se deshace la importación
    const result = await undoImportBatch(batch.id)
    expect(result.deleted).toBe(1)

    // Entonces: la fila manual sigue
    const rows = await db
      .select({ description: transactions.transactionDescription })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.transactionDescription, "Manual")
        )
      )
    expect(rows).toHaveLength(1)
  })

  it("IB-10: el historial devuelve los lotes del usuario, más nuevos primero", async () => {
    // Dado: dos importaciones
    const { userId, accountId } = await setup("imports10@test.com")
    await save({ accountId, rows: [buildRow(0)], fingerprint: HASH_A })
    await save({ accountId, rows: [buildRow(1)], fingerprint: HASH_B })

    // Cuando: se pide el historial
    const result = await getRecentImportBatches(20)

    // Entonces: llegan ambas, la última primero
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(2)
    expect(result.data[0].fileHash).toBe(HASH_B)
    expect(result.data[1].fileHash).toBe(HASH_A)
    expect(result.data[0].accountName).toBe("Cuenta Test")
    expect(userId).toBeGreaterThan(0)
  })
})
