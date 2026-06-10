import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { useCCL } from '../hooks/useCCL'
import { usePrecios, usePreciosSubyacentes } from '../hooks/usePrecios'
import { useInstrumentos } from '../hooks/useInstrumentos'
import { useDividendos } from '../hooks/useDividendos'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { ResumenCard } from '../components/dashboard/ResumenCard'
import { HoldingsTable } from '../components/dashboard/HoldingsTable'
import { calcularTenencias, calcularXIRR, cashflowsDesdeTransacciones } from '../lib/calculations'
import { cn } from '../lib/utils'
import type { ResumenPortfolio } from '../types'

export function DashboardPage() {
  const { data: portfolios = [], isLoading: loadingPortfolios } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const portfolioActual = portfolios.find(p => p.id === (selectedId ?? portfolios[0]?.id)) ?? null
  const activeId = portfolioActual?.id ?? null
  const tipo = portfolioActual?.tipo ?? 'cedear'

  const qc = useQueryClient()
  const { data: transacciones = [], isLoading: loadingTx } = useTransacciones(activeId ?? undefined)
  const { data: ccl } = useCCL()
  const { data: instrumentos = {} } = useInstrumentos()
  const { data: dividendos = [] } = useDividendos(activeId ?? undefined)

  const tickers = useMemo(
    () => [...new Set(transacciones.map(t => t.ticker))],
    [transacciones],
  )

  const {
    data: precios = {},
    dataUpdatedAt,
    isFetching: fetchingPrecios,
  } = usePrecios(tickers, tipo)

  // Subyacentes US — solo para CEDEARs (precio teórico / CCL implícito)
  const tickersSubyacentes = useMemo(() => {
    if (tipo !== 'cedear') return []
    return [...new Set(tickers.map(t => instrumentos[t]?.ticker_subyacente ?? t))]
  }, [tickers, instrumentos, tipo])
  const { data: preciosSubyacentes = {} } = usePreciosSubyacentes(tickersSubyacentes)

  const tenencias = useMemo(() => {
    if (!ccl) return []
    return calcularTenencias(transacciones, precios, ccl, instrumentos, preciosSubyacentes)
  }, [transacciones, precios, ccl, instrumentos, preciosSubyacentes])

  const resumen = useMemo((): ResumenPortfolio => {
    const valor_ars = tenencias.reduce((s, t) => s + t.valor_actual_ars, 0)
    const valor_usd = tenencias.reduce((s, t) => s + t.valor_actual_usd, 0)
    const costo_ars = tenencias.reduce((s, t) => s + t.costo_total_ars, 0)
    const costo_usd = tenencias.reduce((s, t) => s + t.costo_total_usd, 0)
    const pnl_ars = valor_ars - costo_ars
    const pnl_usd = valor_usd - costo_usd

    const dividendos_ars = ccl
      ? dividendos.reduce((s, d) => s + (d.moneda === 'ARS' ? d.monto : d.monto * ccl.valor), 0)
      : 0
    const dividendos_usd = ccl
      ? dividendos.reduce((s, d) => s + (d.moneda === 'USD' ? d.monto : d.monto / ccl.valor), 0)
      : 0

    let xirr_ars: number | undefined
    let xirr_usd: number | undefined
    if (ccl && transacciones.length > 0) {
      const divs = dividendos.map(d => ({ fecha: d.fecha, monto: d.monto, moneda: d.moneda }))
      xirr_ars = calcularXIRR(cashflowsDesdeTransacciones(transacciones, valor_ars, 'ars', divs, ccl))
      xirr_usd = calcularXIRR(cashflowsDesdeTransacciones(transacciones, valor_usd, 'usd', divs, ccl))
    }

    return {
      valor_ars, valor_usd, costo_ars, costo_usd,
      pnl_ars, pnl_usd,
      pnl_pct_ars: costo_ars > 0 ? (pnl_ars / costo_ars) * 100 : 0,
      pnl_pct_usd: costo_usd > 0 ? (pnl_usd / costo_usd) * 100 : 0,
      xirr_ars, xirr_usd,
      dividendos_ars, dividendos_usd,
    }
  }, [tenencias, ccl, transacciones, dividendos])

  function refrescarPrecios() {
    qc.invalidateQueries({ queryKey: ['precios'] })
    qc.invalidateQueries({ queryKey: ['precios-sub'] })
    qc.invalidateQueries({ queryKey: ['ccl'] })
  }

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
          <div className="mt-6 flex justify-center">
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
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {ccl && <span>CCL ${ccl.valor.toFixed(0)}</span>}
          {dataUpdatedAt > 0 && (
            <span>
              Actualizado {new Date(dataUpdatedAt).toLocaleTimeString('es-AR')}
            </span>
          )}
          <button
            onClick={refrescarPrecios}
            title="Refrescar precios"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', fetchingPrecios && 'animate-spin')} />
          </button>
        </div>
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
              <span className="text-xs text-gray-500">
                {tenencias.length} activos · precios cada 30s
              </span>
            </div>
            <HoldingsTable tenencias={tenencias} tipo={tipo} />
          </div>
        </>
      )}
    </div>
  )
}
