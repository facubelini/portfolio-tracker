import type { PrecioMercado, CCL } from '../../types'

// data912.com — API pública de CEDEARs, acciones AR, CCL/MEP e histórico.
// Documentación: https://data912.com
// Si hay CORS, los endpoints se rutean por la Edge Function de Supabase (/market-proxy).

const BASE = 'https://data912.com'

// ── Tipos internos ──────────────────────────────────────────────────────────

interface Data912Panel {
  ticker: string
  ultimo: number
  variacion: number
  // puede tener más campos
}

interface Data912CCL {
  ccl: number
  mep: number
  fecha: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`data912 ${path}: ${res.status}`)
  return res.json()
}

// ── Exports ──────────────────────────────────────────────────────────────────

export async function getPrecioCedear(ticker: string): Promise<PrecioMercado> {
  const data = await get<Data912Panel>(`/api/cedears/${ticker}`)
  return {
    ticker,
    precio_ars: data.ultimo,
    variacion_dia_pct: data.variacion,
  }
}

export async function getPreciosCedears(tickers: string[]): Promise<PrecioMercado[]> {
  const all = await get<Data912Panel[]>('/api/cedears')
  const set = new Set(tickers.map(t => t.toUpperCase()))
  return all
    .filter(p => set.has(p.ticker.toUpperCase()))
    .map(p => ({
      ticker: p.ticker,
      precio_ars: p.ultimo,
      variacion_dia_pct: p.variacion,
    }))
}

export async function getCCLdesdeData912(): Promise<CCL> {
  const data = await get<Data912CCL>('/api/dolar/ccl')
  return {
    valor: data.ccl,
    fecha: data.fecha,
    fuente: 'data912/ccl',
  }
}

export async function getPrecioSubyacenteUS(ticker: string): Promise<PrecioMercado> {
  const data = await get<Data912Panel>(`/api/usa/${ticker}`)
  return {
    ticker,
    precio_usd: data.ultimo,
    variacion_dia_pct: data.variacion,
  }
}

export async function getHistoricoCedear(ticker: string): Promise<{ fecha: string; cierre: number }[]> {
  return get(`/api/cedears/${ticker}/historico`)
}
