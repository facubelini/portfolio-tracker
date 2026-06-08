import type { PrecioMercado } from '../../types'

const BASE = 'https://api.binance.com/api/v3'

interface BinanceTicker24h {
  symbol: string
  lastPrice: string
  priceChangePercent: string
}

export async function getPrecioCripto(symbol: string): Promise<PrecioMercado> {
  const res = await fetch(`${BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}USDT`)
  if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`)
  const data: BinanceTicker24h = await res.json()
  return {
    ticker: symbol.toUpperCase(),
    precio_usd: parseFloat(data.lastPrice),
    variacion_dia_pct: parseFloat(data.priceChangePercent),
  }
}

export async function getPreciosCripto(symbols: string[]): Promise<PrecioMercado[]> {
  const results = await Promise.allSettled(symbols.map(s => getPrecioCripto(s)))
  return results
    .filter((r): r is PromiseFulfilledResult<PrecioMercado> => r.status === 'fulfilled')
    .map(r => r.value)
}
