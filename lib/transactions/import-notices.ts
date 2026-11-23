import type {
  DuplicatePreviewEntry,
  ImportBatchSummary,
} from "@/types/transactions.types"

/**
 * Avisos del panel "Review these notices" de la importación masiva.
 *
 * Es una función pura (y de cliente) a propósito: los avisos de duplicados
 * dependen de la cuenta y de la moneda, así que se recalculan cada vez que el
 * preview se refresca. Si se guardaran como strings en un estado mutable, un
 * refresco pisaría o duplicaría textos viejos.
 */

export interface ImportNoticeInput {
  /** Warnings/errores del parser, calculados una sola vez al leer el archivo. */
  parserWarnings: string[]
  duplicateMeta: Record<string, DuplicatePreviewEntry>
  omitDuplicates: boolean
  /** Lote previo con la misma huella en la misma cuenta, si existe. */
  batch: ImportBatchSummary | null
}

const formatBatchDate = (date: Date): string => {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")

  return `${day}/${month}/${date.getUTCFullYear()}`
}

const plural = (count: number, singular: string, pluralForm: string) =>
  count === 1 ? singular : pluralForm

export const buildImportNotices = ({
  parserWarnings,
  duplicateMeta,
  omitDuplicates,
  batch,
}: ImportNoticeInput): string[] => {
  const notices: string[] = []

  if (batch) {
    const date = formatBatchDate(batch.createdAt)

    if (batch.undoneAt) {
      notices.push(
        `This file was imported on ${date} and later undone: importing it again will save the same movements`
      )
    } else {
      const count = batch.savedCount
      notices.push(
        `This file was already imported on ${date} (${count} ${plural(
          count,
          "transaction",
          "transactions"
        )} saved): import it again only if you need to`
      )
    }
  }

  let exactCount = 0
  let possibleCount = 0

  for (const entry of Object.values(duplicateMeta)) {
    if (entry.exact) exactCount += 1
    else if (entry.possible) possibleCount += 1
  }

  if (exactCount > 0) {
    notices.push(
      `${exactCount} ${plural(exactCount, "row", "rows")} already imported: ${
        exactCount === 1 ? "it" : "they"
      } will be ${
        omitDuplicates
          ? `skipped as ${plural(exactCount, "duplicate", "duplicates")}`
          : "saved again"
      }`
    )
  }

  if (possibleCount > 0) {
    notices.push(
      `${possibleCount} ${plural(
        possibleCount,
        "row",
        "rows"
      )} may duplicate an existing transaction (no reference to confirm it)`
    )
  }

  notices.push(...parserWarnings)

  return notices
}
