import { beforeEach, describe, expect, it, vi } from "vitest"
import { sql } from "drizzle-orm"

import { db } from "@/db"
import {
  bankAccounts,
  categories,
  transactions,
  users,
} from "@/db/schema/schema"
import { truncateDatabase } from "@/tests/setup/db"
import { DEFAULT_CATEGORY_NAME } from "@/lib/categories"
import {
  createBulkTransactions,
  previewTransactionDuplicates,
} from "@/server/transactions/actions"
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
      accountNumber: `DEDUPE-${accountSequence}`,
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
  /** Valores editables (los que se guardan). */
  amount?: string
  date?: string
  type?: "income" | "expense"
  reference?: string | null
  description?: string
  /** Valores congelados por el parser (los que hashean). */
  snapshot?: Partial<DedupeOriginal>
  occurrence?: number
  /** `false` simula una fila sin snapshot (alta manual). */
  withSnapshot?: boolean
}

function buildRow(index: number, options: RowOptions = {}): Record<string, unknown> {
  const {
    tempId = `temp-${index}`,
    amount = "10.00",
    date = "2026-01-10",
    type = "expense",
    reference = "REF-1",
    description = "COMPRA POS",
    snapshot,
    occurrence = 1,
    withSnapshot = true,
  } = options

  const row: Record<string, unknown> = {
    tempId,
    row: index + 1,
    amount,
    transactionType: type,
    transactionDescription: description,
    transactionDate: date,
    bankReference: reference,
  }

  if (withSnapshot) {
    row.dedupe = {
      original: {
        date,
        amount,
        type,
        reference,
        description,
        currency: "HNL",
        ...snapshot,
      },
      occurrence,
    }
  }

  return row
}

function buildFormData({
  accountId,
  rows,
  omitDuplicates,
  currency,
}: {
  accountId: number
  rows: unknown[]
  omitDuplicates?: boolean
  currency?: string
}): FormData {
  const formData = new FormData()
  formData.set("accountId", String(accountId))
  formData.set("transactionsJson", JSON.stringify(rows))

  if (omitDuplicates !== undefined) {
    formData.set("omitDuplicates", omitDuplicates ? "true" : "false")
  }
  if (currency) formData.set("transactionCurrency", currency)

  return formData
}

const save = (
  accountId: number,
  rows: unknown[],
  options: { omitDuplicates?: boolean; currency?: string } = {}
) => createBulkTransactions(null, buildFormData({ accountId, rows, ...options }))

async function listOccurrences(accountId: number) {
  const rows = await db
    .select({
      occurrence: transactions.dedupeOccurrence,
      hash: transactions.dedupeHash,
      amount: transactions.amount,
      reference: transactions.bankReference,
    })
    .from(transactions)
    .where(sql`${transactions.accountId} = ${accountId}`)

  return rows.sort((a, b) => a.occurrence - b.occurrence)
}

beforeEach(async () => {
  await truncateDatabase()
  vi.clearAllMocks()
  session.userId = null
})

// --- createBulkTransactions -----------------------------------------------

describe("createBulkTransactions: deduplicación", () => {
  it("D-01: reimportar el mismo archivo no duplica nada", async () => {
    // Dado: un lote ya guardado
    const { accountId } = await setup("dedupe01@test.com")
    const rows = [buildRow(0), buildRow(1, { reference: "REF-2" })]

    const first = await save(accountId, rows)
    expect(first?.saved).toBe(2)
    expect(first?.skipped).toBe(0)

    // Cuando: se importa el mismo archivo otra vez
    const second = await save(accountId, rows)

    // Entonces: no se guarda nada y se reporta como omitido
    expect(second?.success).toBe(true)
    expect(second?.saved).toBe(0)
    expect(second?.skipped).toBe(2)
    expect(second?.failed).toBe(0)
    expect(second?.message).toBe("2 transactions were already imported")
    expect(second?.savedTempIds).toEqual(["temp-0", "temp-1"])
    expect(second?.rows).toEqual([
      { success: true, status: "duplicate", tempId: "temp-0", row: 1 },
      { success: true, status: "duplicate", tempId: "temp-1", row: 2 },
    ])

    const stored = await listOccurrences(accountId)
    expect(stored).toHaveLength(2)
    expect(stored.map((row) => row.occurrence)).toEqual([1, 1])
  })

  it("D-02: dos filas idénticas del mismo archivo son ocurrencias 1 y 2", async () => {
    // Dado: un archivo con dos compras idénticas
    const { accountId } = await setup("dedupe02@test.com")
    const rows = [
      buildRow(0, { occurrence: 1 }),
      buildRow(1, { occurrence: 2 }),
    ]

    // Cuando: se guardan
    const result = await save(accountId, rows)

    // Entonces: ambas se guardan, numeradas
    expect(result?.saved).toBe(2)
    const stored = await listOccurrences(accountId)
    expect(stored.map((row) => row.occurrence)).toEqual([1, 2])
    expect(new Set(stored.map((row) => row.hash)).size).toBe(1)

    // Y: reimportar el archivo no agrega ninguna
    const again = await save(accountId, rows)
    expect(again?.saved).toBe(0)
    expect(again?.skipped).toBe(2)
    expect(await listOccurrences(accountId)).toHaveLength(2)
  })

  it("D-03: editar monto y fecha en el preview no cambia la identidad", async () => {
    // Dado: una fila importada con monto y fecha editados (el snapshot conserva
    // los valores originales del parser)
    const { accountId } = await setup("dedupe03@test.com")
    const edited = buildRow(0, {
      amount: "99.99",
      date: "2026-02-05",
      snapshot: { amount: "10.00", date: "2026-01-10" },
    })

    const first = await save(accountId, [edited])
    expect(first?.saved).toBe(1)

    // Y: la fila guardada tiene los valores editados
    const [stored] = await db
      .select()
      .from(transactions)
      .where(sql`${transactions.accountId} = ${accountId}`)
    expect(stored.amount).toBe("99.99")

    // Cuando: se reimporta el archivo original (sin ediciones)
    const original = buildRow(0, { amount: "10.00", date: "2026-01-10" })
    const second = await save(accountId, [original])

    // Entonces: se detecta como duplicado, porque el hash viene del snapshot
    expect(second?.saved).toBe(0)
    expect(second?.skipped).toBe(1)
    expect(await listOccurrences(accountId)).toHaveLength(1)
  })

  it("D-04: borrar una copia y reimportar el archivo guarda solo la faltante", async () => {
    // Dado: dos copias idénticas de las que solo se guardó la ocurrencia 2
    const { accountId } = await setup("dedupe04@test.com")
    const kept = buildRow(0, { occurrence: 2 })

    await save(accountId, [kept])
    expect((await listOccurrences(accountId)).map((row) => row.occurrence)).toEqual(
      [2]
    )

    // Cuando: se reimporta el archivo completo
    const full = [
      buildRow(0, { occurrence: 1 }),
      buildRow(1, { occurrence: 2 }),
    ]
    const result = await save(accountId, full)

    // Entonces: se repone solo la ocurrencia que faltaba
    expect(result?.saved).toBe(1)
    expect(result?.skipped).toBe(1)
    // Las dos filas salen de la tabla: una guardada y otra omitida
    expect(new Set(result?.savedTempIds)).toEqual(
      new Set(["temp-0", "temp-1"])
    )
    expect((await listOccurrences(accountId)).map((row) => row.occurrence)).toEqual(
      [1, 2]
    )
  })

  it("D-05: sin omitir duplicados, otro archivo con el mismo movimiento usa la ocurrencia libre", async () => {
    // Dado: un movimiento ya importado desde un archivo
    const { accountId } = await setup("dedupe05@test.com")
    await save(accountId, [buildRow(0, { occurrence: 1 })])

    // Cuando: llega otro archivo con el mismo movimiento y el usuario
    // desmarca "omitir duplicados exactos" (afirma que es real)
    const result = await save(accountId, [buildRow(0, { occurrence: 1 })], {
      omitDuplicates: false,
    })

    // Entonces: se guarda con la siguiente ocurrencia libre
    expect(result?.saved).toBe(1)
    expect(result?.skipped).toBe(0)
    expect((await listOccurrences(accountId)).map((row) => row.occurrence)).toEqual(
      [1, 2]
    )
  })

  it("D-06: el UNIQUE rechaza el duplicado y el insert no-op no rompe", async () => {
    // Dado: un usuario con cuenta y categoría
    const { userId, accountId, categoryId } = await setup("dedupe06@test.com")
    const hash = "a".repeat(64)

    const base = {
      userId,
      accountId,
      amount: "10.00",
      transactionType: "expense" as const,
      transactionDate: new Date("2026-01-10T00:00:00"),
      categoryId,
      bankReference: "REF-1",
      dedupeHash: hash,
      dedupeOccurrence: 1,
    }

    // Cuando: se intenta insertar dos veces la misma identidad
    await db.insert(transactions).values(base)

    // Entonces: el índice único la rechaza (drizzle envuelve el error del driver)
    const duplicateError = await db
      .insert(transactions)
      .values(base)
      .then(() => null)
      .catch((error: unknown) => error)

    expect(duplicateError).not.toBeNull()
    const detail = String(
      (duplicateError as { cause?: { message?: string } })?.cause?.message ??
        (duplicateError as Error)?.message
    )
    expect(detail).toMatch(/duplicate entry/i)

    // Y: con `onDuplicateKeyUpdate` no-op no rompe y no crea una segunda fila.
    // (`affectedRows` no sirve como señal: mysql2 activa CLIENT_FOUND_ROWS, así
    // que un no-op también reporta 1.)
    const [header] = await db
      .insert(transactions)
      .values(base)
      .onDuplicateKeyUpdate({ set: { id: sql`transaction_id` } })
    expect(header.affectedRows).toBe(1)
    expect(await listOccurrences(accountId)).toHaveLength(1)
  })

  it("D-07: las filas sin snapshot no entran al dedupe", async () => {
    // Dado: dos filas idénticas sin identidad congelada (alta manual)
    const { accountId } = await setup("dedupe07@test.com")
    const rows = [
      buildRow(0, { withSnapshot: false }),
      buildRow(1, { withSnapshot: false }),
    ]

    // Cuando: se guardan dos veces
    const first = await save(accountId, rows)
    const second = await save(accountId, rows)

    // Entonces: se guardan todas y ninguna queda con hash
    expect(first?.saved).toBe(2)
    expect(second?.saved).toBe(2)
    const stored = await listOccurrences(accountId)
    expect(stored).toHaveLength(4)
    expect(stored.every((row) => row.hash === null)).toBe(true)
  })

  it("D-08: un snapshot inválido rechaza la fila con error claro", async () => {
    // Dado: una fila con ocurrencia 0 (fuera de smallint)
    const { accountId } = await setup("dedupe08@test.com")
    const rows = [buildRow(0, { occurrence: 0 })]

    // Cuando: se guarda el lote
    const result = await save(accountId, rows)

    // Entonces: la fila falla y no se guarda sin hash en silencio
    expect(result?.saved).toBe(0)
    expect(result?.failed).toBe(1)
    expect(result?.success).toBe(false)
    expect(result?.rows[0]).toMatchObject({
      status: "failed",
      error: "Invalid duplicate snapshot",
    })
    expect(await listOccurrences(accountId)).toHaveLength(0)
  })

  it("D-09: las omitidas no figuran como fallidas", async () => {
    // Dado: un archivo ya importado
    const { accountId } = await setup("dedupe09@test.com")
    const rows = [buildRow(0)]
    await save(accountId, rows)

    // Cuando: se reimporta
    const result = await save(accountId, rows)

    // Entonces: la fila es "duplicate", no "failed", y el mensaje no mezcla
    expect(result?.rows[0].status).toBe("duplicate")
    expect(result?.rows[0].success).toBe(true)
    expect(result?.message).not.toContain("failed")
  })
})

// --- previewTransactionDuplicates ----------------------------------------

describe("previewTransactionDuplicates", () => {
  it("D-10: marca como exacto lo que ya está importado", async () => {
    // Dado: un lote ya guardado
    const { accountId } = await setup("dedupe10@test.com")
    const rows = [buildRow(0), buildRow(1, { reference: "REF-2" })]
    await save(accountId, rows)

    // Cuando: se consulta el preview con las mismas filas
    const preview = await previewTransactionDuplicates({
      accountId,
      currency: "HNL",
      rows,
    })

    // Entonces: ambas son exactas
    expect(preview.success).toBe(true)
    expect(preview.exactCount).toBe(2)
    expect(preview.possibleCount).toBe(0)
    expect(preview.duplicates["temp-0"]).toEqual({
      exact: true,
      possible: false,
    })
    expect(preview.duplicates["temp-1"]).toEqual({
      exact: true,
      possible: false,
    })
  })

  it("D-11: el preview sigue siendo válido después de editar monto y fecha", async () => {
    // Dado: una fila importada con valores editados
    const { accountId } = await setup("dedupe11@test.com")
    await save(accountId, [
      buildRow(0, {
        amount: "99.99",
        date: "2026-02-05",
        snapshot: { amount: "10.00", date: "2026-01-10" },
      }),
    ])

    // Cuando: se previsualiza el archivo original
    const preview = await previewTransactionDuplicates({
      accountId,
      currency: "HNL",
      rows: [buildRow(0)],
    })

    // Entonces: la identidad no cambió y se detecta igual
    expect(preview.exactCount).toBe(1)
    expect(preview.duplicates["temp-0"].exact).toBe(true)
  })

  it("D-12: advierte un posible duplicado cuando falta la referencia", async () => {
    // Dado: una fila existente sin referencia
    const { userId, accountId, categoryId } = await setup("dedupe12@test.com")
    await db.insert(transactions).values({
      userId,
      accountId,
      amount: "10.00",
      transactionType: "expense",
      transactionDate: new Date("2026-01-10T00:00:00"),
      categoryId,
      transactionDescription: "COMPRA POS",
      bankReference: null,
    })

    // Cuando: se previsualiza una fila con el mismo día, monto y tipo, sin
    // referencia y con otra descripción (por ejemplo, el PDF del mismo mes)
    const preview = await previewTransactionDuplicates({
      accountId,
      currency: "HNL",
      rows: [
        buildRow(0, {
          reference: null,
          description: "PAGO CON TARJETA",
        }),
      ],
    })

    // Entonces: no es exacto, pero se advierte
    expect(preview.exactCount).toBe(0)
    expect(preview.possibleCount).toBe(1)
    expect(preview.duplicates["temp-0"]).toEqual({
      exact: false,
      possible: true,
    })
  })

  it("D-13: dos referencias distintas descartan el duplicado posible", async () => {
    // Dado: una fila existente con referencia
    const { userId, accountId, categoryId } = await setup("dedupe13@test.com")
    await db.insert(transactions).values({
      userId,
      accountId,
      amount: "10.00",
      transactionType: "expense",
      transactionDate: new Date("2026-01-10T00:00:00"),
      categoryId,
      bankReference: "REF-A",
    })

    // Cuando: se previsualiza otra referencia con el mismo monto y fecha
    const preview = await previewTransactionDuplicates({
      accountId,
      currency: "HNL",
      rows: [buildRow(0, { reference: "REF-B" })],
    })

    // Entonces: son movimientos distintos y no se marca nada
    expect(preview.exactCount).toBe(0)
    expect(preview.possibleCount).toBe(0)
    expect(preview.duplicates["temp-0"]).toBeUndefined()
  })

  it("D-14: ignora filas inválidas sin romper el resto", async () => {
    // Dado: un archivo con una fila rota y una válida ya importada
    const { accountId } = await setup("dedupe14@test.com")
    await save(accountId, [buildRow(0)])

    // Cuando: se previsualizan ambas
    const preview = await previewTransactionDuplicates({
      accountId,
      currency: "HNL",
      rows: [buildRow(0), { tempId: "temp-1", amount: "abc" }],
    })

    // Entonces: la válida se marca y la inválida se ignora
    expect(preview.success).toBe(true)
    expect(preview.exactCount).toBe(1)
    expect(preview.duplicates["temp-0"].exact).toBe(true)
    expect(preview.duplicates["temp-1"]).toBeUndefined()
  })

  it("D-15: sin sesión el preview no consulta nada", async () => {
    const preview = await previewTransactionDuplicates({
      accountId: 1,
      currency: "HNL",
      rows: [buildRow(0)],
    })

    expect(preview.success).toBe(false)
    expect(preview.message).toBe("Unauthorized: a valid session is required")
    expect(preview.duplicates).toEqual({})
  })
})
