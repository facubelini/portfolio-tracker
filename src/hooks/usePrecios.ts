import { useQuery } from '@tanstack/react-query'
import { getPanelCedears, getPanelUSA } from '../lib/api/data912'
import { getPreciosCripto } from '../lib/api/binance'
import type { PortfolioTipo, MapaPrecios } from '../types'
import { useCCL } from './useCCL'

export const REFRESCO_PRECIOS_MS = 30_000

// Precios en vivo de los activos en cartera (con variación diaria %)
export function usePrecios(tickers: string[], tipo: PortfolioTipo) {
  const { data: ccl } = useCCL()

  return useQuery<MapaPrecios>({
    queryKey: ['precios', tipo, [...tickers].sort().join(',')],
    enabled: tickers.length > 0 && !!ccl,
    queryFn: async () => {
      const map: MapaPrecios = {}

      if (tipo === 'cedear') {
        const panel = await getPanelCedears()
        const porSymbol = new Map(panel.map(p => [p.symbol.toUpperCase(), p]))
        for (const t of tickers) {
          const row = porSymbol.get(t.toUpperCase())
          if (row?.c) {
            map[t] = {
              ars: row.c,
              usd: ccl ? row.c / ccl.valor : undefined,
              varDiaPct: row.pct_change,
            }
          }
        }
      } else {
        const precios = await getPreciosCripto(tickers)
        for (const p of precios) {
          if (p.precio_usd != null) {
            map[p.ticker] = {
              usd: p.precio_usd,
              ars: ccl ? p.precio_usd * ccl.valor : undefined,
              varDiaPct: p.variacion_dia_pct,
            }
          }
        }
      }

      return map
    },
    staleTime: REFRESCO_PRECIOS_MS,
    refetchInterval: REFRESCO_PRECIOS_MS,
  })
}

// Precios USD de subyacentes US (para precio teórico del CEDEAR).
// Nota: el panel usa_stocks de data912 no incluye ETFs (SPY/QQQ); para esos
// tickers simplemente no se muestra el teórico.
export function usePreciosSubyacentes(tickers: string[]) {
  return useQuery<MapaPrecios>({
    queryKey: ['precios-sub', [...tickers].sort().join(',')],
    enabled: tickers.length > 0,
    queryFn: async () => {
      const panel = await getPanelUSA()
      const porSymbol = new Map(panel.map(p => [p.symbol.toUpperCase(), p]))
      const map: MapaPrecios = {}
      for (const t of tickers) {
        const row = porSymbol.get(t.toUpperCase())
        if (row?.c) map[t] = { usd: row.c, varDiaPct: row.pct_change }
      }
      return map
    },
    staleTime: REFRESCO_PRECIOS_MS,
    refetchInterval: REFRESCO_PRECIOS_MS,
  })
}
