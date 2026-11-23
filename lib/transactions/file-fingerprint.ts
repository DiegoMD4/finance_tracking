/**
 * Huella de documento para detectar "este archivo ya se importó".
 *
 * Corre en el navegador: el server action descarta el archivo del `FormData`
 * (no se suben los bytes), así que la huella se calcula acá y viaja como texto.
 * Es un dato **advisory**: el servidor solo valida el formato y lo usa para
 * avisar, nunca para autorizar nada.
 *
 * `crypto.subtle` requiere contexto seguro (https o localhost). Si no está
 * disponible, o la lectura falla, se devuelve `null` y la importación sigue
 * funcionando sin huella.
 */

const SHA256_HEX = /^[0-9a-f]{64}$/

export const computeFileFingerprint = async (
  file: File
): Promise<string | null> => {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null

    const buffer = await file.arrayBuffer()
    const digest = await subtle.digest("SHA-256", buffer)

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return null
  }
}

/** `true` si el valor es un SHA-256 en hex minúsculas de 64 caracteres. */
export const isValidFileFingerprint = (value: unknown): value is string =>
  typeof value === "string" && SHA256_HEX.test(value)
