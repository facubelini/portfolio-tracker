import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useQuery, useQueries } from '@tanstack/react-query'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { useCCLHistorico } from '../hooks/useCCL'
import { getHistoricoCedear, type D912Bar } from '../lib/api/data912'
import { getKlines, type KlineBar } from '../lib/api/binance'
import { valorEnFecha, type CotizacionDia } from '../lib/api/argentinadatos'
import { montoCompra, montoVenta } from '../lib/calculations'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { formatUSD, formatPct } from '../lib/utils'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import type { Transaccion } from '../types'

// Método "mismos aportes en las mismas fechas": cada compra/venta se replica en el
// benchmark (SPY para CEDEARs, BTC para cripto) al precio USD de ese día, y se
// compara la evolución del valor de ambas carteras en USD.

interface PuntoUSD {
  fecha: string // YYYY-MM-DD
  usd: number
}

// Última cotización <= fecha (serie asc); si la fecha es anterior al inicio, primer valor
function crearLookup(serie: PuntoUSD[]): (fecha: string) => number | null {
  return (fecha: string) => {
    if (serie.length === 0) return null
    let lo = 0
    let hi = serie.length - 1
    let best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (serie[mid].fecha <= fecha) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best === -1 ? serie[0].usd : serie[best].usd
  }
}

// CEDEAR en ARS + serie CCL → serie USD
function cedearAUSD(bars: D912Bar[], serieCCL: CotizacionDia[]): PuntoUSD[] {
  const out: PuntoUSD[] = []
  for (const b of bars) {
    const ccl = valorEnFecha(serieCCL, b.date)
    if (ccl && b.c > 0) out.push({ fecha: b.date, usd: b.c / ccl })
  }
  return out
}

const klinesAUSD = (bars: KlineBar[]): PuntoUSD[] =>
  bars.map(k => ({ fecha: k.fecha, usd: k.cierre }))

interface Resultado {
  curva: { fecha: string; portfolio: number; benchmark: number }[]
  aportesNetosUSD: number
  valorPort: number
  valorBench: number
}

function calcularReplica(
  transacciones: Transaccion[],
  seriesPort: Record<string, PuntoUSD[]>,
  serieBench: PuntoUSD[],
): Resultado | null {
  const txs = [...transacciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (txs.length === 0 || serieBench.length === 0) return null

  const lookupBench = crearLookup(serieBench)
  const lookups = Object.fromEntries(
    Object.entries(seriesPort).map(([t, s]) => [t, crearLookup(s)]),
  )

  // Réplica: cada movimiento compra/vende USD equivalentes del benchmark ese día
  const eventosBench: { fecha: string; deltaUnits: number }[] = []
  const eventosQty: Record<string, { fecha: string; delta: number }[]> = {}
  let aportesNetosUSD = 0

  for (const tx of txs) {
    const m = tx.tipo === 'compra' ? montoCompra(tx) : montoVenta(tx)
    const signo = tx.tipo === 'compra' ? 1 : -1
    aportesNetosUSD += signo * m.usd
    const pb = lookupBench(tx.fecha)
    if (pb) eventosBench.push({ fecha: tx.fecha, deltaUnits: (signo * m.usd) / pb })
    ;(eventosQty[tx.ticker] ??= []).push({ fecha: tx.fecha, delta: signo * tx.cantidad })
  }

  const fechaInicio = txs[0].fecha
  const curva: Resultado['curva'] = []

  for (const bar of serieBench) {
    if (bar.fecha < fechaInicio) continue

    let units = 0
    for (const ev of eventosBench) if (ev.fecha <= bar.fecha) units += ev.deltaUnits

    let portVal = 0
    for (const [ticker, evs] of Object.entries(eventosQty)) {
      let qty = 0
      for (const ev of evs) if (ev.fecha <= bar.fecha) qty += ev.delta
      if (qty <= 1e-12) continue
      const p = lookups[ticker]?.(bar.fecha)
      if (p) portVal += qty * p
    }

    curva.push({ fecha: bar.fecha, portfolio: portVal, benchmark: units * bar.usd })
  }

  const ultimo = curva.at(-1)
  if (!ultimo) return null
  return { curva, aportesNetosUSD, valorPort: ultimo.portfolio, valorBench: ultimo.benchmark }
}

export function BenchmarkPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const portfolioActual = portfolios.find(p => p.id === activeId)
  const esCripto = portfolioActual?.tipo === 'cripto'
  const benchTicker = esCripto ? 'BTC' : 'SPY'

  const { data: transacciones = [] } = useTransacciones(activeId ?? undefined)
  const tickers = useMemo(() => [...new Set(transacciones.map(t => t.ticker))], [transacciones])

  const { data: serieCCL } = useCCLHistorico()

  const historicosQ = useQueries({
    queries: tickers.map(t => ({
      queryKey: ['historico', esCripto ? 'cripto' : 'cedear', t],
      queryFn: () => (esCripto ? getKlines(`${t}USDT`) : getHistoricoCedear(t)),
      staleTime: 3_600_000,
      retry: 1,
    })),
  })

  const benchQ = useQuery<KlineBar[] | D912Bar[]>({
    queryKey: ['historico', esCripto ? 'cripto' : 'cedear', benchTicker],
    queryFn: () => (esCripto ? getKlines(`${benchTicker}USDT`) : getHistoricoCedear(benchTicker)),
    staleTime: 3_600_000,
    retry: 1,
  })

  const cargando =
    benchQ.isLoading ||
    historicosQ.some(q => q.isLoading) ||
    (!esCripto && !serieCCL)

  const actualizadoEn = historicosQ.map(q => q.dataUpdatedAt).join('|') + benchQ.dataUpdatedAt

  const resultado = useMemo(() => {
    if (cargando || !benchQ.data) return null
    if (!esCripto && !serieCCL) return null

    const seriesPort: Record<string, PuntoUSD[]> = {}
    tickers.forEach((t, i) => {
      const data = historicosQ[i]?.data
      if (!data) return
      seriesPort[t] = esCripto
        ? klinesAUSD(data as KlineBar[])
        : cedearAUSD(data as D912Bar[], serieCCL!)
    })

    const serieBench = esCripto
      ? klinesAUSD(benchQ.data as KlineBar[])
      : cedearAUSD(benchQ.data as D912Bar[], serieCCL!)

    return calcularReplica(transacciones, seriesPort, serieBench)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transacciones, tickers, esCripto, serieCCL, cargando, actualizadoEn])

  const retPort = resultado && resultado.aportesNetosUSD > 0
    ? (resultado.valorPort / resultado.aportesNetosUSD - 1) * 100 : null
  const retBench = resultado && resultado.aportesNetosUSD > 0
    ? (resultado.valorBench / resultado.aportesNetosUSD - 1) * 100 : null
  const alpha = retPort !== null && retBench !== null ? retPort - retBench : null

  const fallidos = historicosQ
    .map((q, i) => (q.isError ? tickers[i] : null))
    .filter(Boolean) as string[]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />

      {transacciones.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-3xl mb-2">📊</div>
          <p>Cargá movimientos para comparar contra {benchTicker}.</p>
        </div>
      ) : cargando ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : !resultado ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No se pudo armar la comparación (sin datos históricos suficientes).
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader><CardTitle>Aportes netos</CardTitle></CardHeader>
              <div className="text-xl font-semibold text-gray-100">{formatUSD(resultado.aportesNetosUSD)}</div>
              <div className="text-xs text-gray-500 mt-1">USD invertidos</div>
            </Card>
            <Card>
              <CardHeader><CardTitle>Mi portfolio</CardTitle></CardHeader>
              <div className="text-xl font-semibold text-gray-100">{formatUSD(resultado.valorPort)}</div>
              {retPort !== null && (
                <div className={`text-sm mt-1 font-medium ${retPort >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPct(retPort)}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader><CardTitle>Réplica en {benchTicker}</CardTitle></CardHeader>
              <div className="text-xl font-semibold text-gray-100">{formatUSD(resultado.valorBench)}</div>
              {retBench !== null && (
                <div className={`text-sm mt-1 font-medium ${retBench >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPct(retBench)}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader><CardTitle>Alpha</CardTitle></CardHeader>
              {alpha !== null ? (
                <>
                  <div className={`text-xl font-semibold ${alpha >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPct(alpha)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {alpha >= 0 ? `Le ganás a ${benchTicker}` : `${benchTicker} te gana`}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 mt-2">—</div>
              )}
            </Card>
          </div>

          {fallidos.length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
              Sin histórico para: {fallidos.join(', ')} — esos activos no suman a la curva del portfolio.
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-1">
              Valor en USD — Mi portfolio vs réplica en {benchTicker}
            </h2>
            <p className="text-xs text-gray-600 mb-4">
              Cada movimiento se replica en {benchTicker} al precio USD de ese día
              {esCripto ? ' (Binance)' : ' (CEDEAR SPY / CCL del día)'}.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={resultado.curva}>
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={d => d.slice(2, 7)}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  domain={['auto', 'auto']}
                  tickFormatter={v => `$${Math.round(Number(v)).toLocaleString('en-US')}`}
                  width={70}
                />
                <Tooltip
                  formatter={(v, name) => [typeof v === 'number' ? formatUSD(v) : v, name]}
                  labelFormatter={l => `Fecha: ${l}`}
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                />
                <Legend />
                <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} name="Mi portfolio" />
                <Line type="monotone" dataKey="benchmark" stroke="#f59e0b" strokeWidth={2} dot={false} name={`Réplica ${benchTicker}`} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
