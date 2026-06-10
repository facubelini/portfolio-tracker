import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones } from '../hooks/useTransacciones'
import { usePrecios } from '../hooks/usePrecios'
import { useCCL } from '../hooks/useCCL'
import { useInstrumentos } from '../hooks/useInstrumentos'
import { calcularTenencias } from '../lib/calculations'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { formatPct, formatUSD } from '../lib/utils'

const COLORES = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#ec4899', '#84cc16', '#14b8a6', '#a78bfa']

export function ComposicionPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const portfolioActual = portfolios.find(p => p.id === activeId)

  const { data: transacciones = [] } = useTransacciones(activeId ?? undefined)
  const { data: ccl } = useCCL()
  const { data: instrumentos = {} } = useInstrumentos()
  const tickers = useMemo(() => [...new Set(transacciones.map(t => t.ticker))], [transacciones])
  const { data: precios = {} } = usePrecios(tickers, portfolioActual?.tipo ?? 'cedear')

  const tenencias = useMemo(() => {
    if (!ccl) return []
    return calcularTenencias(transacciones, precios, ccl, instrumentos)
  }, [transacciones, precios, ccl, instrumentos])

  const porActivo = tenencias.map((t, i) => ({
    name: t.ticker,
    value: t.peso_cartera,
    usd: t.valor_actual_usd,
    color: COLORES[i % COLORES.length],
  }))

  const porSector = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of tenencias) {
      const sector = t.instrumento?.sector ?? 'Sin clasificar'
      map[sector] = (map[sector] ?? 0) + t.valor_actual_usd
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .map(([name, usd], i) => ({ name, usd, pct: total > 0 ? (usd / total) * 100 : 0, color: COLORES[i % COLORES.length] }))
      .sort((a, b) => b.usd - a.usd)
  }, [tenencias])

  if (tenencias.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />
        <div className="text-center py-16 text-gray-500">
          <div className="text-3xl mb-2">🥧</div>
          <p>Sin datos para mostrar todavía.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por activo */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Por activo</h2>
          <div className="flex gap-4 items-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={porActivo} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {porActivo.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => typeof v === 'number' ? formatPct(v) : v} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 flex-1">
              {porActivo.map(item => (
                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    <span className="text-gray-300 font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400">{formatPct(item.value)}</span>
                    <span className="text-gray-600 ml-1">{formatUSD(item.usd)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Por sector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Por sector</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porSector} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip formatter={(v) => typeof v === 'number' ? formatPct(v) : v} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {porSector.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
