import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { useCCL } from '../hooks/useCCL'
import { usePrecios } from '../hooks/usePrecios'
import { calcularTenencias } from '../lib/calculations'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { formatUSD, formatPct } from '../lib/utils'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'

// Benchmark simplificado: compara P&L % real vs rendimiento del índice desde fecha de primera compra
// La curva de equity requiere histórico de precios día a día; en esta versión mostramos el resumen numérico.
// TODO: agregar histórico vía data912 para curva completa.

export function BenchmarkPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const portfolioActual = portfolios.find(p => p.id === activeId)

  const { data: transacciones = [] } = useTransacciones(activeId ?? undefined)
  const { data: ccl } = useCCL()
  const tickers = useMemo(() => [...new Set(transacciones.map(t => t.ticker))], [transacciones])
  const { data: precios = {} } = usePrecios(tickers, portfolioActual?.tipo ?? 'cedear')
  const { data: preciosBench = {} } = usePrecios(
    portfolioActual?.tipo === 'cripto' ? ['BTC'] : ['SPY'],
    portfolioActual?.tipo === 'cripto' ? 'cripto' : 'cedear',
  )

  const tenencias = useMemo(() => {
    if (!ccl) return []
    return calcularTenencias(transacciones, precios, ccl, {})
  }, [transacciones, precios, ccl])

  const benchmarkTicker = portfolioActual?.tipo === 'cripto' ? 'BTC' : 'SPY'

  const benchmarkActual = preciosBench[benchmarkTicker]

  // Benchmark simulado: inversión hipotética total al precio de la primera compra
  const primerCompra = transacciones
    .filter(t => t.tipo === 'compra')
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0]

  const costoTotalUSD = tenencias.reduce((s, t) => s + t.costo_total_usd, 0)
  const valorActualUSD = tenencias.reduce((s, t) => s + t.valor_actual_usd, 0)
  const pnlPctUSD = costoTotalUSD > 0 ? ((valorActualUSD - costoTotalUSD) / costoTotalUSD) * 100 : 0

  // Datos de gráfico placeholder (requiere histórico real)
  const chartData = [
    { fecha: primerCompra?.fecha ?? '—', portfolio: 100, benchmark: 100 },
    { fecha: 'Hoy', portfolio: 100 + pnlPctUSD, benchmark: 100 },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Mi portfolio (USD)</CardTitle></CardHeader>
          <div className="text-xl font-semibold text-gray-100">{formatUSD(valorActualUSD)}</div>
          <div className={`text-sm mt-1 ${pnlPctUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(pnlPctUSD)}</div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Benchmark ({benchmarkTicker})</CardTitle></CardHeader>
          <div className="text-xl font-semibold text-gray-100">
            {benchmarkActual?.usd ? formatUSD(benchmarkActual.usd) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Precio actual</div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Alpha vs {benchmarkTicker}</CardTitle></CardHeader>
          <div className="text-sm text-gray-400 mt-2">
            Disponible con histórico de precios (próximamente)
          </div>
        </Card>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Curva de equity — Portfolio vs {benchmarkTicker} (base 100)</h2>
        <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2 mb-4">
          Curva completa disponible una vez integrado el histórico de precios vía data912. Actualmente se muestran solo los puntos extremos.
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={['auto', 'auto']} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} dot={false} name="Mi portfolio" />
            <Line type="monotone" dataKey="benchmark" stroke="#f59e0b" strokeWidth={2} dot={false} name={benchmarkTicker} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
