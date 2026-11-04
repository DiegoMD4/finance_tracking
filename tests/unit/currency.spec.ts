import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getExchangeRate, getExchangeRates } from "@/lib/currency"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  // L-04 y L-05 provocan errores esperados; silenciamos el log del módulo.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("getExchangeRate", () => {
  it("L-01:returns 1 for same currency without calling the API", async () => {
    const rate = await getExchangeRate("HNL", "HNL")

    expect(rate).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("L-02:uses a cached rate without calling the API again", async () => {
    // Dado: una primera llamada que llena el caché
    fetchMock.mockResolvedValueOnce(jsonResponse({ rates: { HNL: 2.5 } }))
    await getExchangeRate("C02", "HNL")
    fetchMock.mockClear()

    // Cuando: se vuelve a pedir la misma tasa
    const rate = await getExchangeRate("C02", "HNL")

    // Entonces: sale del caché y no hay fetch
    expect(rate).toBe(2.5)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("L-03:gets rate from API and fills cache", async () => {
    // Dado: la API responde con una tasa
    fetchMock.mockResolvedValueOnce(jsonResponse({ rates: { HNL: 3.75 } }))

    // Cuando: se pide la tasa
    const rate = await getExchangeRate("C03", "HNL")

    // Entonces: retorna el valor correcto y consulta la URL esperada
    expect(rate).toBe(3.75)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/C03"
    )

    // Y: la segunda llamada ya no toca la API
    fetchMock.mockClear()
    expect(await getExchangeRate("C03", "HNL")).toBe(3.75)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("L-04:throws an error when API responds with error", async () => {
    // Dado: la API responde 500
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 500 }))

    // Cuando/Entonces: se propaga el status en el mensaje
    await expect(getExchangeRate("C04", "HNL")).rejects.toThrow(
      "Exchange API error: 500"
    )
  })

  it("L-05:throws an error when target currency is not in response", async () => {
    // Dado: la API responde sin la tasa de HNL
    fetchMock.mockResolvedValueOnce(jsonResponse({ rates: { EUR: 0.9 } }))

    // Cuando/Entonces: se informa la moneda faltante
    await expect(getExchangeRate("C05", "HNL")).rejects.toThrow(
      "No rate found for HNL"
    )
  })
})

describe("getExchangeRates", () => {
  it("L-06:returns rates for multiple currencies with a single fetch", async () => {
    // Dado: la API devuelve ambas tasas
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ rates: { HNL: 24.5, EUR: 0.9 } })
    )

    // Cuando: se piden dos monedas
    const rates = await getExchangeRates("C06", ["HNL", "EUR"])

    // Entonces: se devuelven todas con una sola llamada
    expect(rates).toEqual({ HNL: 24.5, EUR: 0.9 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/C06"
    )
  })

  it("L-07:asks API only for currencies not in cache", async () => {
    // Dado: una primera llamada que cachea HNL y EUR (todas las tasas devueltas)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ rates: { HNL: 24.5, EUR: 0.9 } })
    )
    await getExchangeRates("C07", ["HNL"])
    fetchMock.mockClear()

    // Cuando: se pide HNL (cacheada) y GBP (pendiente)
    fetchMock.mockResolvedValueOnce(jsonResponse({ rates: { GBP: 0.8 } }))
    const rates = await getExchangeRates("C07", ["HNL", "GBP"])

    // Entonces: solo hay un fetch, para la moneda pendiente
    expect(rates).toEqual({ HNL: 24.5, GBP: 0.8 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/C07"
    )
  })

  it("L-06b:returns 1 for same currency without calling the API", async () => {
    // Dado: la moneda destino es igual a la de origen
    const rates = await getExchangeRates("USD", ["USD"])

    // Entonces: se resuelve localmente sin fetch
    expect(rates).toEqual({ USD: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
