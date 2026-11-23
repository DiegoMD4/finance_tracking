import { describe, expect, it } from "vitest"

import { isValidFileFingerprint } from "@/lib/transactions/file-fingerprint"
import { buildImportNotices } from "@/lib/transactions/import-notices"
import type {
  DuplicatePreviewEntry,
  ImportBatchSummary,
} from "@/types/transactions.types"

const buildBatch = (
  overrides: Partial<ImportBatchSummary> = {}
): ImportBatchSummary => ({
  id: 1,
  accountId: 66,
  accountName: "Cuenta ahorros",
  fileName: "statement.xlsx",
  fileHash: "a".repeat(64),
  fileSize: 2048,
  sourceFormat: "excel",
  rowCount: 2,
  savedCount: 2,
  skippedCount: 0,
  failedCount: 0,
  createdAt: new Date("2026-10-14T12:00:00.000Z"),
  undoneAt: null,
  ...overrides,
})

const entry = (overrides: Partial<DuplicatePreviewEntry>): DuplicatePreviewEntry => ({
  exact: false,
  possible: false,
  ...overrides,
})

describe("isValidFileFingerprint", () => {
  it("acepta un SHA-256 en hex minúsculas", () => {
    expect(isValidFileFingerprint("a".repeat(64))).toBe(true)
    expect(isValidFileFingerprint("0123456789abcdef".repeat(4))).toBe(true)
  })

  it("rechaza formatos inválidos", () => {
    expect(isValidFileFingerprint("A".repeat(64))).toBe(false)
    expect(isValidFileFingerprint("a".repeat(63))).toBe(false)
    expect(isValidFileFingerprint("a".repeat(65))).toBe(false)
    expect(isValidFileFingerprint("g".repeat(64))).toBe(false)
    expect(isValidFileFingerprint("")).toBe(false)
    expect(isValidFileFingerprint(null)).toBe(false)
    expect(isValidFileFingerprint(42)).toBe(false)
  })
})

describe("buildImportNotices", () => {
  it("pone el aviso del lote primero y respeta el orden del resto", () => {
    const notices = buildImportNotices({
      parserWarnings: ["Parser warning"],
      duplicateMeta: {
        a: entry({ exact: true }),
        b: entry({ possible: true }),
      },
      omitDuplicates: true,
      batch: buildBatch(),
    })

    expect(notices).toEqual([
      "This file was already imported on 14/10/2026 (2 transactions saved): import it again only if you need to",
      "1 row already imported: it will be skipped as duplicate",
      "1 row may duplicate an existing transaction (no reference to confirm it)",
      "Parser warning",
    ])
  })

  it("cambia el texto cuando el checkbox está desmarcado", () => {
    const notices = buildImportNotices({
      parserWarnings: [],
      duplicateMeta: { a: entry({ exact: true }), b: entry({ exact: true }) },
      omitDuplicates: false,
      batch: null,
    })

    expect(notices).toEqual(["2 rows already imported: they will be saved again"])
  })

  it("marca el lote deshecho para que el usuario sepa que puede reimportar", () => {
    const notices = buildImportNotices({
      parserWarnings: [],
      duplicateMeta: {},
      omitDuplicates: true,
      batch: buildBatch({ undoneAt: new Date("2026-10-15T09:00:00.000Z") }),
    })

    expect(notices).toEqual([
      "This file was imported on 14/10/2026 and later undone: importing it again will save the same movements",
    ])
  })

  it("devuelve solo los warnings del parser cuando no hay duplicados ni lote", () => {
    const notices = buildImportNotices({
      parserWarnings: ["Only warning"],
      duplicateMeta: {},
      omitDuplicates: true,
      batch: null,
    })

    expect(notices).toEqual(["Only warning"])
  })
})
