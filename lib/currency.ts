type CacheItem = { rate: number; expiresAt: number }

const CACHE = new Map<string, CacheItem>()
const TTL_MS = 12 * 60 * 60 * 1000 // 12 horas

export async function getExchangeRate(
  from: string,
  to: string
): Promise<number> {
  if (from === to) return 1
  const key = `${from}-${to}`
  const now = Date.now()
  const cached = CACHE.get(key)

  if (cached) {
    if (cached.expiresAt > now) {
      return cached.rate
    }
    CACHE.delete(key)
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`)
    if (!res.ok) throw new Error(`Exchange API error: ${res.status}`)
    const data = await res.json()
    const rates = data.rates ?? {}

    // Guardamos TODAS las tasas que nos dio la API en caché para no volver a pedir esta moneda base
    for (const [targetCurrency, rateValue] of Object.entries(rates)) {
      CACHE.set(`${from}-${targetCurrency}`, {
        rate: Number(rateValue),
        expiresAt: now + TTL_MS,
      })
    }

    const rate = rates[to]
    if (!rate) throw new Error(`No rate found for ${to}`)
    return Number(rate)
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `No se pudo obtener la tasa de conversión de ${from} a ${to}. Error: ${message}`
    )
  }
}

export async function getExchangeRates(
  from: string,
  tos: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const pending: string[] = []
  const now = Date.now()

  for (const to of tos) {
    if (from === to) {
      result[to] = 1
      continue
    }
    const key = `${from}-${to}`
    const cached = CACHE.get(key)

    if (cached) {
      if (cached.expiresAt > now) {
        result[to] = cached.rate
      } else {
        CACHE.delete(key) // Borrado pasivo si expiró
        pending.push(to)
      }
    } else {
      pending.push(to)
    }
  }

  if (pending.length > 0) {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${from}`)
      if (!res.ok) throw new Error(`Exchange API error: ${res.status}`)
      const data = await res.json()
      const rates = data.rates ?? {}

      // Poblamos todo el caché
      for (const [targetCurrency, rateValue] of Object.entries(rates)) {
        CACHE.set(`${from}-${targetCurrency}`, {
          rate: Number(rateValue),
          expiresAt: now + TTL_MS,
        })
      }

      for (const to of pending) {
        const rate = rates[to]
        if (!rate) throw new Error(`No rate found for ${to}`)
        result[to] = Number(rate)
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `No se pudieron obtener las tasas de conversión de ${from}. Error: ${message}`
      )
    }
  }

  return result
}

// Barrido pasivo cada 12 horas para liberar memoria
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of CACHE.entries()) {
    if (value.expiresAt <= now) {
      CACHE.delete(key)
    }
  }
}, TTL_MS)
