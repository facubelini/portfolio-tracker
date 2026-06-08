import { useState, useMemo } from 'react'
import { usePortfolios } from '../hooks/usePortfolios'
import { useTransacciones, useAgregarTransaccion, useEliminarTransaccion } from '../hooks/useTransacciones'
import { useCCL } from '../hooks/useCCL'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { PortfolioTabs } from '../components/dashboard/PortfolioTabs'
import { formatARS, formatUSD } from '../lib/utils'
import { Trash2 } from 'lucide-react'
import type { Transaccion, TransaccionTipo, Moneda } from '../types'

const MONEDAS: Moneda[] = ['ARS', 'USD']

function TransaccionForm({ portfolioId, tipo, onClose }: { portfolioId: string; tipo: 'cedear' | 'cripto'; onClose: () => void }) {
  const { data: ccl } = useCCL()
  const agregar = useAgregarTransaccion()

  const [form, setForm] = useState({
    ticker: '',
    tipoTx: 'compra' as TransaccionTipo,
    fecha: new Date().toISOString().split('T')[0],
    cantidad: '',
    precio_unitario: '',
    comision: '0',
    ccl_snapshot: ccl?.valor.toFixed(2) ?? '',
    moneda: tipo === 'cedear' ? 'ARS' : 'USD' as Moneda,
    notas: '',
  })
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.ticker || !form.cantidad || !form.precio_unitario || !form.ccl_snapshot) {
      setError('Completá todos los campos obligatorios')
      return
    }
    try {
      await agregar.mutateAsync({
        portfolio_id: portfolioId,
        ticker: form.ticker.toUpperCase().trim(),
        tipo: form.tipoTx,
        fecha: form.fecha,
        cantidad: parseFloat(form.cantidad),
        precio_unitario: parseFloat(form.precio_unitario),
        comision: parseFloat(form.comision) || 0,
        ccl_snapshot: parseFloat(form.ccl_snapshot),
        moneda: form.moneda,
        notas: form.notas || undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  return (
    <form onSubmit={submit} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="font-medium text-gray-200">Nueva transacción</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Tipo</label>
          <select value={form.tipoTx} onChange={e => set('tipoTx', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-100">
            <option value="compra">Compra</option>
            <option value="venta">Venta</option>
          </select>
        </div>
        <Input label="Ticker" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())}
          placeholder={tipo === 'cedear' ? 'AAPL' : 'BTC'} required />
        <Input label="Fecha" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Moneda</label>
          <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-100">
            {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <Input label="Cantidad" type="number" step="any" min="0" value={form.cantidad}
          onChange={e => set('cantidad', e.target.value)} required />
        <Input label="Precio unitario" type="number" step="any" min="0" value={form.precio_unitario}
          onChange={e => set('precio_unitario', e.target.value)} required />
        <Input label="Comisión" type="number" step="any" min="0" value={form.comision}
          onChange={e => set('comision', e.target.value)} />
        <Input label="CCL al momento" type="number" step="any" min="0" value={form.ccl_snapshot}
          onChange={e => set('ccl_snapshot', e.target.value)} required />
      </div>

      <Input label="Notas (opcional)" value={form.notas} onChange={e => set('notas', e.target.value)} />

      {error && <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex gap-2">
        <Button type="submit" loading={agregar.isPending}>Guardar</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}

export function TransaccionesPage() {
  const { data: portfolios = [] } = usePortfolios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? portfolios[0]?.id ?? null
  const portfolioActual = portfolios.find(p => p.id === activeId)

  const { data: transacciones = [], isLoading } = useTransacciones(activeId ?? undefined)
  const eliminar = useEliminarTransaccion()
  const [showForm, setShowForm] = useState(false)

  const sorted = useMemo(
    () => [...transacciones].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [transacciones],
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PortfolioTabs portfolios={portfolios} selected={activeId} onSelect={setSelectedId} />
        {activeId && !showForm && (
          <Button onClick={() => setShowForm(true)}>+ Movimiento</Button>
        )}
      </div>

      {showForm && activeId && portfolioActual && (
        <TransaccionForm portfolioId={activeId} tipo={portfolioActual.tipo} onClose={() => setShowForm(false)} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-3xl mb-2">📋</div>
          <p>Sin movimientos registrados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 px-3">Fecha</th>
                <th className="text-left py-2 px-3">Ticker</th>
                <th className="text-left py-2 px-3">Tipo</th>
                <th className="text-right py-2 px-3">Cantidad</th>
                <th className="text-right py-2 px-3">Precio</th>
                <th className="text-right py-2 px-3">Comisión</th>
                <th className="text-right py-2 px-3">CCL</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx: Transaccion) => (
                <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-400">{tx.fecha}</td>
                  <td className="py-2 px-3 font-medium text-gray-100">{tx.ticker}</td>
                  <td className="py-2 px-3">
                    <Badge variant={tx.tipo === 'compra' ? 'green' : 'red'}>{tx.tipo}</Badge>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-300">{tx.cantidad}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-300">
                    {tx.moneda === 'ARS' ? formatARS(tx.precio_unitario) : formatUSD(tx.precio_unitario)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">
                    {tx.comision > 0 ? formatARS(tx.comision) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">${tx.ccl_snapshot.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-300">
                    {tx.moneda === 'ARS'
                      ? formatARS(tx.cantidad * tx.precio_unitario + tx.comision)
                      : formatUSD(tx.cantidad * tx.precio_unitario)}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => eliminar.mutate({ id: tx.id, portfolioId: tx.portfolio_id })}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
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
