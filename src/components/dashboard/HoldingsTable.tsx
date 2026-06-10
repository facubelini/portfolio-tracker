import { cn, formatARS, formatUSD, formatPct } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import type { Tenencia } from '../../types'

interface Props {
  tenencias: Tenencia[]
  tipo: 'cedear' | 'cripto'
}

function PnlCell({ monto, pct, formato }: { monto: number; pct: number; formato: (v: number) => string }) {
  return (
    <td className={cn('text-right py-2.5 px-3 tabular-nums font-medium', monto >= 0 ? 'text-green-400' : 'text-red-400')}>
      {formato(monto)}
      <div className="text-xs font-normal opacity-80">{formatPct(pct)}</div>
    </td>
  )
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

  const esCedear = tipo === 'cedear'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-2 px-3 font-medium">Ticker</th>
            {esCedear && <th className="text-right py-2 px-3 font-medium">Ratio</th>}
            <th className="text-right py-2 px-3 font-medium">Cantidad</th>
            <th className="text-right py-2 px-3 font-medium">PPC</th>
            <th className="text-right py-2 px-3 font-medium">Precio actual</th>
            <th className="text-right py-2 px-3 font-medium">Hoy</th>
            <th className="text-right py-2 px-3 font-medium">% Cartera</th>
            <th className="text-right py-2 px-3 font-medium">Valor</th>
            <th className="text-right py-2 px-3 font-medium">P&L ARS</th>
            <th className="text-right py-2 px-3 font-medium">P&L USD</th>
            {esCedear && <th className="text-right py-2 px-3 font-medium">vs CCL</th>}
          </tr>
        </thead>
        <tbody>
          {tenencias.map(t => {
            const varDia = t.variacion_dia_pct
            const cambioDia = esCedear ? t.cambio_dia_ars : t.cambio_dia_usd
            return (
              <tr key={t.ticker} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="font-medium text-gray-100">{t.ticker}</div>
                  {t.instrumento?.nombre && (
                    <div className="text-xs text-gray-500 truncate max-w-[120px]">{t.instrumento.nombre}</div>
                  )}
                </td>

                {esCedear && (
                  <td className="text-right py-2.5 px-3 text-gray-400">
                    {t.ratio_usado ? `${t.ratio_usado}:1` : '—'}
                  </td>
                )}

                <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                  {t.cantidad_neta.toLocaleString('es-AR', { maximumFractionDigits: tipo === 'cripto' ? 8 : 0 })}
                </td>

                <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                  {esCedear ? formatARS(t.ppc_ars) : formatUSD(t.ppc_usd)}
                  <div className="text-xs text-gray-600">
                    {esCedear ? formatUSD(t.ppc_usd) : formatARS(t.ppc_ars)}
                  </div>
                </td>

                {/* Cotización en tiempo real + variación del día */}
                <td className="text-right py-2.5 px-3 tabular-nums">
                  <span className="text-gray-100 font-medium">
                    {esCedear ? formatARS(t.precio_actual_ars) : formatUSD(t.precio_actual_usd)}
                  </span>
                  {varDia != null && (
                    <div className={cn('text-xs font-medium', varDia >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {formatPct(varDia)} hoy
                    </div>
                  )}
                </td>

                <td className={cn(
                  'text-right py-2.5 px-3 tabular-nums text-xs font-medium',
                  cambioDia == null ? 'text-gray-600' : cambioDia >= 0 ? 'text-green-400' : 'text-red-400',
                )}>
                  {cambioDia != null
                    ? (esCedear ? formatARS(cambioDia) : formatUSD(cambioDia))
                    : '—'}
                </td>

                <td className="text-right py-2.5 px-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-1 bg-blue-600 rounded-full" style={{ width: `${Math.min(t.peso_cartera, 100) * 0.6}px` }} />
                    <span className="tabular-nums text-gray-400">{t.peso_cartera.toFixed(1)}%</span>
                  </div>
                </td>

                <td className="text-right py-2.5 px-3 tabular-nums text-gray-300">
                  {formatUSD(t.valor_actual_usd)}
                  <div className="text-xs text-gray-600">{formatARS(t.valor_actual_ars)}</div>
                </td>

                <PnlCell monto={t.pnl_ars} pct={t.pnl_pct_ars} formato={formatARS} />
                <PnlCell monto={t.pnl_usd} pct={t.pnl_pct_usd} formato={formatUSD} />

                {esCedear && (
                  <td className="text-right py-2.5 px-3">
                    {t.descuento_premio_pct !== undefined ? (
                      <Badge variant={Math.abs(t.descuento_premio_pct) < 1 ? 'gray' : t.descuento_premio_pct > 0 ? 'red' : 'green'}>
                        {formatPct(t.descuento_premio_pct)}
                      </Badge>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
