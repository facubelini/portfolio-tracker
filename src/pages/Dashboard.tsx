import { useState, useMemo } from 'react'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { useCCL } from '../hooks/useCCL'
import { usePrecios, usePreciosSubyacentes } from '../hooks/usePrecios'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { ResumenCard } from '../components/dashboard/ResumenCard'
import { HoldingsTable } from '../components/dashboard/HoldingsTable'
import { calcularTenencias, calcularXIRR, cashflowsDesdeTransacciones } from '../lib/calculations'
import type { ResumenPortfolio } from '../types'

export function DashboardPage() {
  const { data: portfolios = [], isLoading: loadingPortfolios } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const portfolioActual = portfolios.find(p => p.id === (selectedId ?? portfolios[0]?.id)) ?? null
  const activeId = portfolioActual?.id ?? null

  const { data: transacciones = [], isLoading: loadingTx } = useTransacciones(activeId ?? undefined)
  const { data: ccl } = useCCL()

  const tickers = useMemo(
    () => [...new Set(transacciones.map(t => t.ticker))],
    [transacciones],
  )

  const { data: precios = {} } = usePrecios(tickers, portfolioActual?.tipo ?? 'cedear')

  // Subyacentes US para precio teórico (solo CEDEARs)
  const tickersSubyacentes = useMemo(() => {
    if (portfolioActual?.tipo !== 'cedear') return []
    return tickers // mismo ticker → Yahoo Finance lo busca directo (sin .BA)
  }, [tickers, portfolioActual?.tipo])
  const { data: preciosUSA = {} } = usePreciosSubyacentes(tickersSubyacentes)

  // Merge: precio ARS de CEDEAR + precio USD del subyacente
  const preciosMerged = useMemo(() => {
    if (portfolioActual?.tipo !== 'cedear') return precios
    const merged: typeof precios = { ...precios }
    for (const ticker of tickers) {
      const usdSub = preciosUSA[ticker]?.usd
      if (usdSub && !merged[ticker]?.usd) {
        merged[ticker] = { ...merged[ticker], usd: usdSub }
      }
    }
    return merged
  }, [precios, preciosUSA, tickers, portfolioActual?.tipo])

  const tenencias = useMemo(() => {
    if (!ccl) return []
    return calcularTenencias(transacciones, preciosMerged, ccl, {})
  }, [transacciones, preciosMerged, ccl])

  const resumen = useMemo((): ResumenPortfolio => {
    const valor_ars = tenencias.reduce((s, t) => s + t.valor_actual_ars, 0)
    const valor_usd = tenencias.reduce((s, t) => s + t.valor_actual_usd, 0)
    const costo_ars = tenencias.reduce((s, t) => s + t.costo_total_ars, 0)
    const costo_usd = tenencias.reduce((s, t) => s + t.costo_total_usd, 0)
    const pnl_ars = valor_ars - costo_ars
    const pnl_usd = valor_usd - costo_usd

    let xirr_ars: number | undefined
    let xirr_usd: number | undefined
    if (ccl && transacciones.length > 0) {
      const cfsARS = cashflowsDesdeTransacciones(transacciones, valor_ars, 'ars', [], ccl)
      const cfsUSD = cashflowsDesdeTransacciones(transacciones, valor_usd, 'usd', [], ccl)
      xirr_ars = calcularXIRR(cfsARS)
      xirr_usd = calcularXIRR(cfsUSD)
    }

    return {
      valor_ars, valor_usd, costo_ars, costo_usd,
      pnl_ars, pnl_usd,
      pnl_pct_ars: costo_ars > 0 ? (pnl_ars / costo_ars) * 100 : 0,
      pnl_pct_usd: costo_usd > 0 ? (pnl_usd / costo_usd) * 100 : 0,
      xirr_ars, xirr_usd,
      dividendos_ars: 0,
      dividendos_usd: 0,
    }
  }, [tenencias, ccl, transacciones])

  if (loadingPortfolios) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (portfolios.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-lg font-medium text-gray-300 mb-1">Sin portfolios todavía</p>
          <p className="text-sm">Creá tu primer portfolio con el botón "+ Nuevo"</p>
          <div className="mt-6">
            <PortfolioTabs portfolios={[]} selected={null} onSelect={setSelectedId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PortfolioTabs
          portfolios={portfolios}
          selected={activeId}
          onSelect={setSelectedId}
        />
        {ccl && (
          <span className="text-xs text-gray-500">
            CCL ${ccl.valor.toFixed(0)} · {ccl.fuente}
          </span>
        )}
      </div>

      {loadingTx ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <ResumenCard resumen={resumen} ccl={ccl?.valor} />
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Posiciones</h2>
              <span className="text-xs text-gray-500">{tenencias.length} activos</span>
            </div>
            <HoldingsTable tenencias={tenencias} tipo={portfolioActual?.tipo ?? 'cedear'} />
          </div>
        </>
      )}
    </div>
  )
}
