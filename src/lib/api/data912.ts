// data912.com — API pública, CORS habilitado (verificado: access-control-allow-origin: *)
// Rutas reales según su openapi.json:
//   /live/arg_cedears, /live/arg_stocks, /live/usa_stocks, /live/mep, /live/ccl
//   /historical/cedears/{ticker}, /historical/stocks/{ticker}

const BASE = 'https://data912.com'

export interface D912Live {
  symbol: string
  c: number          // último precio
  pct_change: number // variación diaria %
  px_bid: number
  px_ask: number
  v: number
}

export interface D912Bar {
  date: string // YYYY-MM-DD
  o: number
  h: number
  l: number
  c: number
  v: number
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`data912 ${path}: HTTP ${res.status}`)
  const json = await res.json()
  // la API devuelve 200 con {"Error": "..."} para tickers inexistentes
  if (json && !Array.isArray(json) && typeof json === 'object' && 'Error' in json) {
    throw new Error(`data912 ${path}: ${(json as { Error: string }).Error}`)
  }
  return json as T
}

// Panel completo de CEDEARs en ARS (precio c + pct_change diario)
export const getPanelCedears = () => get<D912Live[]>('/live/arg_cedears')

// Panel de acciones US en USD (subyacentes; no incluye ETFs como SPY)
export const getPanelUSA = () => get<D912Live[]>('/live/usa_stocks')

// Histórico diario de un CEDEAR en ARS (desde ~2012)
export const getHistoricoCedear = (ticker: string) =>
  get<D912Bar[]>(`/historical/cedears/${ticker.toUpperCase()}`)
