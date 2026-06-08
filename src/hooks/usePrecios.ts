import { useQuery } from '@tanstack/react-query'
import { getPreciosCedears, getPreciosUSA } from '../lib/api/yahoo'
import { getPreciosCripto } from '../lib/api/binance'
import type { PortfolioTipo } from '../types'
import { useCCL } from './useCCL'

export function usePrecios(tickers: string[], tipo: PortfolioTipo) {
  const { data: ccl } = useCCL()

  return useQuery<Record<string, { ars?: number; usd?: number }>>({
    queryKey: ['precios', tipo, tickers],
    enabled: tickers.length > 0 && !!ccl,
    queryFn: async () => {
      if (tipo === 'cedear') {
        const precios = await getPreciosCedears(tickers)
        return Object.fromEntries(
          precios.map(p => [
            p.ticker,
            {
              ars: p.precio_ars,
              usd: p.precio_ars && ccl ? p.precio_ars / ccl.valor : undefined,
            },
          ])
        )
      } else {
        const precios = await getPreciosCripto(tickers)
        return Object.fromEntries(
          precios.map(p => [
            p.ticker,
            {
              usd: p.precio_usd,
              ars: p.precio_usd && ccl ? p.precio_usd * ccl.valor : undefined,
            },
          ])
        )
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

// Precios de subyacentes US para calcular precio teórico del CEDEAR
export function usePreciosSubyacentes(tickers: string[]) {
  return useQuery<Record<string, { usd?: number }>>({
    queryKey: ['precios-sub', tickers],
    enabled: tickers.length > 0,
    queryFn: async () => {
      const precios = await getPreciosUSA(tickers)
      return Object.fromEntries(
        precios.map(p => [p.ticker, { usd: p.precio_usd }])
      )
    },
    staleTime: 60_000,
  })
}
