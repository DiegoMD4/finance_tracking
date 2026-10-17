const CACHE = new Map()
const TTL_MS = 12 * 60 * 60 * 1000

export async function getExchangeRate(from: string, to: string) {
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
    const rate = data.rates?.[to]
    if (!rate) throw new Error(`No rate found for ${to}`)
    const numericRate = Number(rate)
    CACHE.set(key, { rate: numericRate, expiresAt: now + TTL_MS })
    return numericRate
  } catch (error) {
    console.log(error)
    throw new Error(
      `No se pudo obtener la tasa de conversión de ${from} a ${to} - error: ${error}`
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
    if (cached && cached.expiresAt > now) {
      result[to] = cached.rate
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
      for (const to of pending) {
        const rate = rates[to]
        if (!rate) throw new Error(`No rate found for ${to}`)
        const numericRate = Number(rate)
        result[to] = numericRate
        CACHE.set(`${from}-${to}`, {
          rate: numericRate,
          expiresAt: now + TTL_MS,
        })
      }
    } catch (error) {
      throw new Error(
        `No se pudieron obtener las tasas de conversión de ${from} - error: ${error}`
      )
    }
  }

  return result
}

setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of CACHE.entries()) {
      if (value.expiresAt <= now) {
        CACHE.delete(key)
      }
    }
  },
  12 * 60 * 60 * 1000
)
