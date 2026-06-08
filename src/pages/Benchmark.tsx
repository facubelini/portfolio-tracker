import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { useCCL } from '../hooks/useCCL'
import { usePrecios } from '../hooks/usePrecios'
import { calcularTenencias } from '../lib/calculations'
import { getHistorico, getHistoricoCedear } from '../lib/api/yahoo'
import { getPreciosCripto } from '../lib/api/binance'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { formatUSD, formatPct, formatARS } from '../lib/utils'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import type { Transaccion } from '../types'
import type { OHLCVBar } from '../lib/api/yahoo'

// Método benchmark: replicar cada compra en USD sobre el benchmark a su precio histórico
// y comparar el valor final. Curva de equity normalizada a base 100.

function calcularCurvaEquity(
  transacciones: Transaccion[],
  historicoPortfolio: Record<string, OHLCVBar[]>,
  historicoBench: OHLCVBar[],
  _ccl: number,
): { fecha: string; portfolio: number; benchmark: number }[] {
  const compras = transacciones
    .filter(t => t.tipo === 'compra')
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  if (compras.length === 0 || historicoBench.length === 0) return []

  const fechaInicio = new Date(compras[0].fecha)

  // Precio del benchmark en la fecha de cada compra (o el más cercano)
  function precioEnFecha(bars: OHLCVBar[], fecha: string): number | null {
    const ts = new Date(fecha).getTime()
    let closest = bars.reduce((prev, cur) =>
      Math.abs(cur.timestamp * 1000 - ts) < Math.abs(prev.timestamp * 1000 - ts) ? cur : prev
    )
    return closest?.cierre ?? null
  }

  // Cuántas unidades de benchmark compraríamos con cada aporte
  let unidadesBench = 0
  for (const tx of compras) {
    const costoUSD = (tx.cantidad * tx.precio_unitario + tx.comision) / tx.ccl_snapshot
    const precioBenchEnFecha = precioEnFecha(historicoBench, tx.fecha)
    if (precioBenchEnFecha && precioBenchEnFecha > 0) {
      unidadesBench += costoUSD / precioBenchEnFecha
    }
  }

  // Construir serie diaria desde fecha inicio
  const serie: { fecha: string; portfolio: number; benchmark: number }[] = []
  let base100Portfolio: number | null = null
  let base100Bench: number | null = null

  // Para el portfolio: valor histórico diario de cada tenencia
  // Simplificación: tomamos el costo acumulado en ARS a cada fecha y el valor de mercado actual
  // Para la curva correcta necesitaríamos precios diarios de cada ticker; usamos el ratio vs el primer día

  for (const bar of historicoBench) {
    if (new Date(bar.fecha) < fechaInicio) continue
    const valorBench = unidadesBench * bar.cierre

    // Valor diario del portfolio: usamos el benchmark del primer ticker disponible como proxy
    // hasta tener histórico de todos los tickers
    const firstTicker = Object.keys(historicoPortfolio)[0]
    const portBars = firstTicker ? historicoPortfolio[firstTicker] : []
    const portMap = new Map(portBars.map(b => [b.fecha, b.cierre]))
    const portPrecio = portMap.get(bar.fecha)

    if (!portPrecio) continue

    if (base100Bench === null) {
      base100Bench = valorBench
      base100Portfolio = portPrecio
    }

    serie.push({
      fecha: bar.fecha,
      portfolio: base100Portfolio ? (portPrecio / base100Portfolio) * 100 : 100,
      benchmark: base100Bench ? (valorBench / base100Bench) * 100 : 100,
    })
  }

  return serie
}

export function BenchmarkPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const portfolioActual = portfolios.find(p => p.id === activeId)

  const { data: transacciones = [] } = useTransacciones(activeId ?? undefined)
  const { data: ccl } = useCCL()
  const tickers = useMemo(() => [...new Set(transacciones.map(t => t.ticker))], [transacciones])
  const { data: precios = {} } = usePrecios(tickers, portfolioActual?.tipo ?? 'cedear')

  const esCripto = portfolioActual?.tipo === 'cripto'
  const benchmarkTicker = esCripto ? 'BTC' : 'SPY'

  const tenencias = useMemo(() => {
    if (!ccl) return []
    return calcularTenencias(transacciones, precios, ccl, {})
  }, [transacciones, precios, ccl])

  const costoTotalUSD = tenencias.reduce((s, t) => s + t.costo_total_usd, 0)
  const valorActualUSD = tenencias.reduce((s, t) => s + t.valor_actual_usd, 0)
  const costoTotalARS = tenencias.reduce((s, t) => s + t.costo_total_ars, 0)
  const valorActualARS = tenencias.reduce((s, t) => s + t.valor_actual_ars, 0)
  const pnlPctUSD = costoTotalUSD > 0 ? ((valorActualUSD - costoTotalUSD) / costoTotalUSD) * 100 : 0
  const pnlPctARS = costoTotalARS > 0 ? ((valorActualARS - costoTotalARS) / costoTotalARS) * 100 : 0

  // Histórico del benchmark (SPY o BTC)
  const { data: historicoBench = [], isLoading: loadingBench } = useQuery({
    queryKey: ['historico-bench', benchmarkTicker],
    queryFn: () => esCripto
      ? getPreciosCripto(['BTC']).then(() => [] as OHLCVBar[]) // BTC histórico: TODO CoinGecko
      : getHistoricoCedear(benchmarkTicker, '1y'),
    staleTime: 300_000,
  })

  // Histórico del primer ticker del portfolio (para curva proxy)
  const primerTicker = tickers[0]
  const { data: historicoPortfolio = [] } = useQuery({
    queryKey: ['historico-portfolio', primerTicker, esCripto],
    enabled: !!primerTicker,
    queryFn: () => esCripto
      ? [] as OHLCVBar[]
      : getHistoricoCedear(primerTicker, '1y'),
    staleTime: 300_000,
  })

  // Precio actual del benchmark
  const { data: precioBenchActual } = useQuery({
    queryKey: ['precio-bench-actual', benchmarkTicker, esCripto],
    queryFn: async () => {
      if (esCripto) {
        const p = await getPreciosCripto(['BTC'])
        return p[0]?.precio_usd
      }
      const bars = await getHistorico(benchmarkTicker, '1mo', '1d')
      return bars.at(-1)?.cierre
    },
    staleTime: 60_000,
  })

  // Precio del benchmark en la fecha de la primera compra
  const primerCompra = useMemo(() =>
    [...transacciones].filter(t => t.tipo === 'compra')
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0],
    [transacciones]
  )

  const precioBenchEnInicio = useMemo(() => {
    if (!primerCompra || historicoBench.length === 0) return null
    const ts = new Date(primerCompra.fecha).getTime()
    return historicoBench.reduce((prev, cur) =>
      Math.abs(cur.timestamp * 1000 - ts) < Math.abs(prev.timestamp * 1000 - ts) ? cur : prev
    ).cierre
  }, [primerCompra, historicoBench])

  const rendimientoBench = useMemo(() => {
    if (!precioBenchEnInicio || !precioBenchActual) return null
    return ((precioBenchActual - precioBenchEnInicio) / precioBenchEnInicio) * 100
  }, [precioBenchEnInicio, precioBenchActual])

  const alphaPct = rendimientoBench !== null ? pnlPctUSD - rendimientoBench : null

  // Curva de equity (portfolio vs benchmark, base 100)
  const curvaData = useMemo(() => {
    if (historicoBench.length === 0 || historicoPortfolio.length === 0) return []
    const portMap: Record<string, OHLCVBar[]> = primerTicker ? { [primerTicker]: historicoPortfolio } : {}
    return calcularCurvaEquity(transacciones, portMap, historicoBench, ccl?.valor ?? 1)
  }, [transacciones, historicoPortfolio, historicoBench, ccl, primerTicker])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>Mi portfolio USD</CardTitle></CardHeader>
          <div className="text-xl font-semibold text-gray-100">{formatUSD(valorActualUSD)}</div>
          <div className={`text-sm mt-1 font-medium ${pnlPctUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(pnlPctUSD)}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mi portfolio ARS</CardTitle></CardHeader>
          <div className="text-xl font-semibold text-gray-100">{formatARS(valorActualARS)}</div>
          <div className={`text-sm mt-1 font-medium ${pnlPctARS >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(pnlPctARS)}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Benchmark {benchmarkTicker}</CardTitle></CardHeader>
          <div className="text-xl font-semibold text-gray-100">
            {rendimientoBench !== null ? formatPct(rendimientoBench) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {primerCompra ? `Desde ${primerCompra.fecha}` : 'Sin datos'}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Alpha vs {benchmarkTicker}</CardTitle></CardHeader>
          {alphaPct !== null ? (
            <>
              <div className={`text-xl font-semibold ${alphaPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPct(alphaPct)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {alphaPct >= 0 ? 'Superás el benchmark' : 'Por debajo del benchmark'}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 mt-2">Calculando…</div>
          )}
        </Card>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-1">
          Curva de equity — Portfolio vs {benchmarkTicker} (base 100)
        </h2>
        <p className="text-xs text-gray-600 mb-4">
          Portfolio = evolución del primer ticker de la cartera. Benchmark = {benchmarkTicker}.BA vía Yahoo Finance.
        </p>

        {loadingBench ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : curvaData.length < 2 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Sin suficientes datos históricos. Cargá al menos una transacción para ver la curva.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={curvaData}>
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={d => d.slice(5)} // MM-DD
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v, name) => [typeof v === 'number' ? `${v.toFixed(1)}` : v, name]}
                labelFormatter={l => `Fecha: ${l}`}
              />
              <Legend />
              <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} name="Mi portfolio" />
              <Line type="monotone" dataKey="benchmark" stroke="#f59e0b" strokeWidth={2} dot={false} name={benchmarkTicker} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
