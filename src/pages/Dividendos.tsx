import { useState } from 'react'
import { usePortfolios } from '../hooks/usePortfolios'
import { useCCL } from '../hooks/useCCL'
import { useDividendos, useAgregarDividendo, useEliminarDividendo } from '../hooks/useDividendos'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { formatARS, formatUSD } from '../lib/utils'
import { Trash2 } from 'lucide-react'
import type { Moneda } from '../types'

export function DividendosPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const { data: dividendos = [] } = useDividendos(activeId ?? undefined)
  const { data: ccl } = useCCL()

  const agregar = useAgregarDividendo(activeId ?? undefined)
  const eliminar = useEliminarDividendo(activeId ?? undefined)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ticker: '', fecha: new Date().toISOString().split('T')[0], monto: '', moneda: 'USD' as Moneda })

  const totalUSD = dividendos.reduce((s, d) => s + (d.moneda === 'USD' ? d.monto : d.monto / (ccl?.valor ?? 1)), 0)
  const totalARS = dividendos.reduce((s, d) => s + (d.moneda === 'ARS' ? d.monto : d.monto * (ccl?.valor ?? 1)), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeId) return
    await agregar.mutateAsync({
      portfolio_id: activeId,
      ticker: form.ticker.toUpperCase().trim(),
      fecha: form.fecha,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
    })
    setForm(f => ({ ...f, ticker: '', monto: '' }))
    setShowForm(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />
        {!showForm && <Button onClick={() => setShowForm(true)}>+ Dividendo</Button>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <Input label="Ticker" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} required className="w-28" />
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
          <Input label="Monto" type="number" step="any" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} required className="w-28" />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Moneda</label>
            <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as Moneda }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-100">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <Button type="submit" loading={agregar.isPending}>Guardar</Button>
          <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total dividendos USD</div>
          <div className="text-xl font-semibold text-green-400">{formatUSD(totalUSD)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total dividendos ARS</div>
          <div className="text-xl font-semibold text-green-400">{formatARS(totalARS)}</div>
        </div>
      </div>

      {dividendos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-3xl mb-2">💰</div>
          <p>Sin dividendos registrados todavía.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3">Fecha</th>
                <th className="text-left py-2 px-3">Ticker</th>
                <th className="text-right py-2 px-3">Monto</th>
                <th className="text-left py-2 px-3">Moneda</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {dividendos.map(d => (
                <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-400">{d.fecha}</td>
                  <td className="py-2 px-3 font-medium text-gray-100">{d.ticker}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-green-400">
                    {d.moneda === 'USD' ? formatUSD(d.monto) : formatARS(d.monto)}
                  </td>
                  <td className="py-2 px-3"><Badge variant={d.moneda === 'USD' ? 'blue' : 'gray'}>{d.moneda}</Badge></td>
                  <td className="py-2 px-3">
                    <button onClick={() => eliminar.mutate(d.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
