import type { PrecioMercado } from '../../types'

// Yahoo Finance — CEDEAR prices via .BA suffix, US stock prices, historical OHLCV.
// query2 supports multi-symbol batch requests; query1 for individual charts.

const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote'
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

interface YFQuote {
  symbol: string
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
  shortName?: string
}

interface YFChartMeta {
  symbol: string
  regularMarketPrice: number
  regularMarketChangePercent?: number
  currency: string
}

async function fetchQuotes(symbols: string[]): Promise<YFQuote[]> {
  const url = `${QUOTE_URL}?symbols=${symbols.join(',')}&fields=regularMarketPrice,regularMarketChangePercent,currency,shortName`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance quotes HTTP ${res.status}`)
  const json = await res.json()
  return (json?.quoteResponse?.result as YFQuote[]) ?? []
}

async function fetchChart(symbol: string): Promise<YFChartMeta> {
  const url = `${CHART_URL}/${symbol}?interval=1d&range=5d`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance chart ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo Finance: sin datos para ${symbol}`)
  return meta as YFChartMeta
}

// ── CEDEARs (Buenos Aires exchange, ticker.BA, precio en ARS) ────────────────

export async function getPreciosCedears(tickers: string[]): Promise<PrecioMercado[]> {
  if (tickers.length === 0) return []
  const baTickers = tickers.map(t => `${t}.BA`)
  try {
    const quotes = await fetchQuotes(baTickers)
    return quotes
      .filter(q => q.regularMarketPrice != null)
      .map(q => ({
        ticker: q.symbol.replace(/\.BA$/i, '').toUpperCase(),
        precio_ars: q.regularMarketPrice,
        variacion_dia_pct: q.regularMarketChangePercent,
      }))
  } catch {
    // fallback individual si el batch falla
    const results = await Promise.allSettled(
      baTickers.map(t => fetchChart(t).then(m => ({
        ticker: t.replace(/\.BA$/i, '').toUpperCase(),
        precio_ars: m.regularMarketPrice,
        variacion_dia_pct: m.regularMarketChangePercent,
      }) as PrecioMercado))
    )
    return results
      .filter((r): r is PromiseFulfilledResult<PrecioMercado> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}

// ── Acciones subyacentes US (para precio teórico del CEDEAR) ────────────────

export async function getPrecioUSA(ticker: string): Promise<PrecioMercado> {
  const meta = await fetchChart(ticker)
  return {
    ticker: ticker.toUpperCase(),
    precio_usd: meta.regularMarketPrice,
    variacion_dia_pct: meta.regularMarketChangePercent,
  }
}

export async function getPreciosUSA(tickers: string[]): Promise<PrecioMercado[]> {
  if (tickers.length === 0) return []
  try {
    const quotes = await fetchQuotes(tickers)
    return quotes
      .filter(q => q.regularMarketPrice != null)
      .map(q => ({
        ticker: q.symbol.toUpperCase(),
        precio_usd: q.regularMarketPrice,
        variacion_dia_pct: q.regularMarketChangePercent,
      }))
  } catch {
    const results = await Promise.allSettled(tickers.map(t => getPrecioUSA(t)))
    return results
      .filter((r): r is PromiseFulfilledResult<PrecioMercado> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}

// ── Histórico de precios (para benchmark) ───────────────────────────────────

export interface OHLCVBar {
  timestamp: number // unix seconds
  fecha: string     // YYYY-MM-DD
  cierre: number
  volumen?: number
}

export async function getHistorico(
  symbol: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' = '1y',
  interval: '1d' | '1wk' = '1d'
): Promise<OHLCVBar[]> {
  const url = `${CHART_URL}/${symbol}?interval=${interval}&range=${range}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo historico ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamps ?? result.timestamp ?? []
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? []

  return timestamps
    .map((ts, i) => ({
      timestamp: ts,
      fecha: new Date(ts * 1000).toISOString().split('T')[0],
      cierre: closes[i],
    }))
    .filter(b => b.cierre != null && !isNaN(b.cierre))
}

// Histórico de CEDEAR en ARS (ticker.BA)
export async function getHistoricoCedear(
  ticker: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '2y' = '1y'
): Promise<OHLCVBar[]> {
  return getHistorico(`${ticker}.BA`, range)
}
