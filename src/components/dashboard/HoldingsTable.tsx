import { cn, formatARS, formatUSD, formatPct } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import type { Tenencia } from '../../types'

interface Props {
  tenencias: Tenencia[]
  tipo: 'cedear' | 'cripto'
}

export function HoldingsTable({ tenencias, tipo }: Props) {
  if (tenencias.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-sm">Sin posiciones todavía. Cargá tu primer movimiento.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-2 px-3 font-medium">Ticker</th>
            {tipo === 'cedear' && <th className="text-right py-2 px-3 font-medium">Ratio</th>}
            <th className="text-right py-2 px-3 font-medium">Cantidad</th>
            <th className="text-right py-2 px-3 font-medium">PPC ARS</th>
            <th className="text-right py-2 px-3 font-medium">Precio actual</th>
            <th className="text-right py-2 px-3 font-medium">% Cartera</th>
            <th className="text-right py-2 px-3 font-medium">Valor USD</th>
            <th className="text-right py-2 px-3 font-medium">P&L ARS</th>
            <th className="text-right py-2 px-3 font-medium">P&L USD</th>
            {tipo === 'cedear' && <th className="text-right py-2 px-3 font-medium">Descuento/Premio</th>}
          </tr>
        </thead>
        <tbody>
          {tenencias.map(t => (
            <tr key={t.ticker} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="py-2.5 px-3">
                <div className="font-medium text-gray-100">{t.ticker}</div>
                {t.instrumento?.nombre && (
                  <div className="text-xs text-gray-500 truncate max-w-[120px]">{t.instrumento.nombre}</div>
                )}
              </td>
              {tipo === 'cedear' && (
                <td className="text-right py-2.5 px-3 text-gray-400">
                  {t.instrumento?.ratio_cedear ? `${t.instrumento.ratio_cedear}:1` : '—'}
                </td>
              )}
              <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                {t.cantidad_neta.toFixed(tipo === 'cripto' ? 6 : 0)}
              </td>
              <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                {formatARS(t.ppc_ars)}
              </td>
              <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                {tipo === 'cedear' ? formatARS(t.precio_actual_ars) : formatUSD(t.precio_actual_usd)}
              </td>
              <td className="text-right py-2.5 px-3">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="h-1 bg-blue-600 rounded-full" style={{ width: `${Math.min(t.peso_cartera, 100) * 0.6}px` }} />
                  <span className="tabular-nums text-gray-400">{t.peso_cartera.toFixed(1)}%</span>
                </div>
              </td>
              <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                {formatUSD(t.valor_actual_usd)}
              </td>
              <td className={cn('text-right py-2.5 px-3 tabular-nums font-medium', t.pnl_ars >= 0 ? 'text-green-400' : 'text-red-400')}>
                {formatARS(t.pnl_ars)}
                <div className="text-xs font-normal">{formatPct(t.pnl_pct_ars)}</div>
              </td>
              <td className={cn('text-right py-2.5 px-3 tabular-nums font-medium', t.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400')}>
                {formatUSD(t.pnl_usd)}
                <div className="text-xs font-normal">{formatPct(t.pnl_pct_usd)}</div>
              </td>
              {tipo === 'cedear' && (
                <td className="text-right py-2.5 px-3">
                  {t.descuento_premio_pct !== undefined ? (
                    <Badge variant={t.descuento_premio_pct > 0 ? 'green' : 'red'}>
                      {formatPct(t.descuento_premio_pct)} vs CCL
                    </Badge>
                  ) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
