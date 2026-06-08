import { Card, CardHeader, CardTitle } from '../ui/Card'
import { cn, formatARS, formatUSD, formatPct } from '../../lib/utils'
import type { ResumenPortfolio } from '../../types'

interface ResumenCardProps {
  resumen: ResumenPortfolio
  ccl?: number
}

function StatItem({
  label,
  value,
  sub,
  positivo,
  neutro,
}: {
  label: string
  value: string
  sub?: string
  positivo?: boolean
  neutro?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={cn(
          'text-xl font-semibold tabular-nums',
          !neutro && positivo !== undefined
            ? positivo
              ? 'text-green-400'
              : 'text-red-400'
            : 'text-gray-100',
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export function ResumenCard({ resumen, ccl }: ResumenCardProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card>
        <CardHeader><CardTitle>Valor ARS</CardTitle></CardHeader>
        <StatItem label="" value={formatARS(resumen.valor_ars)} neutro />
      </Card>
      <Card>
        <CardHeader><CardTitle>Valor USD</CardTitle></CardHeader>
        <StatItem label="" value={formatUSD(resumen.valor_usd)} sub={ccl ? `CCL $${ccl.toFixed(0)}` : undefined} neutro />
      </Card>
      <Card>
        <CardHeader><CardTitle>P&L ARS</CardTitle></CardHeader>
        <StatItem
          label=""
          value={formatARS(resumen.pnl_ars)}
          sub={formatPct(resumen.pnl_pct_ars)}
          positivo={resumen.pnl_ars >= 0}
        />
      </Card>
      <Card>
        <CardHeader><CardTitle>P&L USD</CardTitle></CardHeader>
        <StatItem
          label=""
          value={formatUSD(resumen.pnl_usd)}
          sub={formatPct(resumen.pnl_pct_usd)}
          positivo={resumen.pnl_usd >= 0}
        />
      </Card>
      <Card>
        <CardHeader><CardTitle>XIRR ARS</CardTitle></CardHeader>
        <StatItem
          label=""
          value={resumen.xirr_ars !== undefined ? formatPct(resumen.xirr_ars * 100) : '—'}
          positivo={resumen.xirr_ars !== undefined ? resumen.xirr_ars >= 0 : undefined}
        />
      </Card>
      <Card>
        <CardHeader><CardTitle>XIRR USD</CardTitle></CardHeader>
        <StatItem
          label=""
          value={resumen.xirr_usd !== undefined ? formatPct(resumen.xirr_usd * 100) : '—'}
          positivo={resumen.xirr_usd !== undefined ? resumen.xirr_usd >= 0 : undefined}
        />
      </Card>
    </div>
  )
}
