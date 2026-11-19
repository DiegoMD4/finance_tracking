import { createHash } from "node:crypto"

import {
  buildDedupePreimage,
  type DedupeIdentityInput,
} from "@/lib/transactions/dedupe"

/**
 * Hash de identidad de una fila importada.
 *
 * **Solo servidor**: usa `node:crypto`. No lo importes desde componentes de
 * cliente (el parser importa `dedupe.ts`, que sí es isomorfo).
 *
 * Devuelve 64 caracteres hex (SHA-256) que se guardan en
 * `transactions.dedupe_hash varchar(64)`.
 */
export const buildDedupeHash = (input: DedupeIdentityInput): string =>
  createHash("sha256")
    .update(buildDedupePreimage(input), "utf8")
    .digest("hex")
