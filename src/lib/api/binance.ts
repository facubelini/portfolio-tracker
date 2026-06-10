import type { PrecioMercado } from '../../types'

// Binance API pública — CORS habilitado (verificado: access-control-allow-origin: *)

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

// ── Histórico diario (klines) — para benchmark y curva de equity ────────────

export interface KlineBar {
  timestamp: number // unix seconds
  fecha: string     // YYYY-MM-DD
  cierre: number
}

export async function getKlines(symbolUSDT: string, limit = 1000): Promise<KlineBar[]> {
  const res = await fetch(
    `${BASE}/klines?symbol=${symbolUSDT.toUpperCase()}&interval=1d&limit=${Math.min(limit, 1000)}`
  )
  if (!res.ok) throw new Error(`Binance klines ${symbolUSDT}: ${res.status}`)
  const data: [number, string, string, string, string, ...unknown[]][] = await res.json()
  return data.map(k => ({
    timestamp: Math.floor(k[0] / 1000),
    fecha: new Date(k[0]).toISOString().split('T')[0],
    cierre: parseFloat(k[4]),
  }))
}
