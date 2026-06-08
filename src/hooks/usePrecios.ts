import { useQuery } from '@tanstack/react-query'
import { getPreciosCedears, getPrecioSubyacenteUS } from '../lib/api/data912'
import { getPreciosCripto } from '../lib/api/binance'
import type { PrecioMercado, PortfolioTipo } from '../types'
import { useCCL } from './useCCL'

export function usePrecios(tickers: string[], tipo: PortfolioTipo) {
  const { data: ccl } = useCCL()

  return useQuery<Record<string, { ars?: number; usd?: number }>>({
    queryKey: ['precios', tipo, tickers],
    enabled: tickers.length > 0,
    queryFn: async () => {
      let precios: PrecioMercado[] = []

      if (tipo === 'cedear') {
        precios = await getPreciosCedears(tickers)
        return Object.fromEntries(
          precios.map(p => [p.ticker, { ars: p.precio_ars, usd: p.precio_ars && ccl ? p.precio_ars / ccl.valor : undefined }])
        )
      } else {
        precios = await getPreciosCripto(tickers)
        return Object.fromEntries(
          precios.map(p => [p.ticker, { usd: p.precio_usd, ars: p.precio_usd && ccl ? p.precio_usd * ccl.valor : undefined }])
        )
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function usePreciosSubyacentes(tickers: string[]) {
  return useQuery<Record<string, { usd?: number }>>({
    queryKey: ['precios-sub', tickers],
    enabled: tickers.length > 0,
    queryFn: async () => {
      const results = await Promise.allSettled(tickers.map(t => getPrecioSubyacenteUS(t)))
      const out: Record<string, { usd?: number }> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') out[tickers[i]] = { usd: r.value.precio_usd }
      })
      return out
    },
    staleTime: 60_000,
  })
}
