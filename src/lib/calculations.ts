import type { Transaccion, Tenencia, Instrumento, CCL } from '../types'

// ── FIFO P&L realizado ───────────────────────────────────────────────────────

interface Lote {
  cantidad: number
  precio_ars: number
  precio_usd: number
}

export function calcularFIFO(
  transacciones: Transaccion[],
): { pnl_realizado_ars: number; pnl_realizado_usd: number } {
  const lotesActivos: Lote[] = []
  let pnl_ars = 0
  let pnl_usd = 0

  const ordenadas = [...transacciones].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  )

  for (const tx of ordenadas) {
    const precio_usd = tx.precio_unitario / tx.ccl_snapshot

    if (tx.tipo === 'compra') {
      lotesActivos.push({
        cantidad: tx.cantidad,
        precio_ars: tx.precio_unitario + tx.comision / tx.cantidad,
        precio_usd: precio_usd,
      })
    } else {
      let restante = tx.cantidad
      while (restante > 0 && lotesActivos.length > 0) {
        const lote = lotesActivos[0]
        const usado = Math.min(restante, lote.cantidad)
        pnl_ars += usado * (tx.precio_unitario - lote.precio_ars)
        pnl_usd += usado * (precio_usd - lote.precio_usd)
        lote.cantidad -= usado
        restante -= usado
        if (lote.cantidad <= 0) lotesActivos.shift()
      }
    }
  }

  return { pnl_realizado_ars: pnl_ars, pnl_realizado_usd: pnl_usd }
}

// ── Precio promedio ponderado ────────────────────────────────────────────────

export function calcularPPC(compras: Transaccion[]): { ppc_ars: number; ppc_usd: number } {
  let totalARS = 0
  let totalUSD = 0
  let totalCantidad = 0

  for (const tx of compras) {
    const costo_ars = tx.cantidad * tx.precio_unitario + tx.comision
    const costo_usd = costo_ars / tx.ccl_snapshot
    totalARS += costo_ars
    totalUSD += costo_usd
    totalCantidad += tx.cantidad
  }

  if (totalCantidad === 0) return { ppc_ars: 0, ppc_usd: 0 }
  return {
    ppc_ars: totalARS / totalCantidad,
    ppc_usd: totalUSD / totalCantidad,
  }
}

// ── Tenencias desde transacciones ───────────────────────────────────────────

export function calcularTenencias(
  transacciones: Transaccion[],
  precios: Record<string, { ars?: number; usd?: number }>,
  ccl: CCL,
  instrumentos: Record<string, Instrumento>,
): Tenencia[] {
  const byTicker: Record<string, Transaccion[]> = {}

  for (const tx of transacciones) {
    if (!byTicker[tx.ticker]) byTicker[tx.ticker] = []
    byTicker[tx.ticker].push(tx)
  }

  const tenencias: Tenencia[] = []
  let valor_total_ars = 0

  const parciales: Omit<Tenencia, 'peso_cartera'>[] = []

  for (const [ticker, txs] of Object.entries(byTicker)) {
    const compras = txs.filter(t => t.tipo === 'compra')
    const ventas = txs.filter(t => t.tipo === 'venta')
    const cantidad_neta =
      compras.reduce((s, t) => s + t.cantidad, 0) -
      ventas.reduce((s, t) => s + t.cantidad, 0)

    if (cantidad_neta <= 0) continue

    const { ppc_ars, ppc_usd } = calcularPPC(compras)
    const costo_total_ars = ppc_ars * cantidad_neta
    const costo_total_usd = ppc_usd * cantidad_neta

    const precio = precios[ticker] ?? {}
    const precio_actual_ars = precio.ars ?? 0
    const precio_actual_usd = precio.usd ?? precio_actual_ars / ccl.valor

    const valor_actual_ars = cantidad_neta * precio_actual_ars
    const valor_actual_usd = cantidad_neta * precio_actual_usd

    valor_total_ars += valor_actual_ars

    const pnl_ars = valor_actual_ars - costo_total_ars
    const pnl_usd = valor_actual_usd - costo_total_usd
    const pnl_pct_ars = costo_total_ars > 0 ? (pnl_ars / costo_total_ars) * 100 : 0
    const pnl_pct_usd = costo_total_usd > 0 ? (pnl_usd / costo_total_usd) * 100 : 0

    const inst = instrumentos[ticker]
    let precio_teorico_usd: number | undefined
    let descuento_premio_pct: number | undefined

    if (inst?.ratio_cedear && inst.ticker_subyacente) {
      const subPrecio = precios[inst.ticker_subyacente]?.usd
      if (subPrecio) {
        precio_teorico_usd = subPrecio / inst.ratio_cedear
        const ccl_implicito = precio_actual_ars / precio_teorico_usd
        descuento_premio_pct = ((ccl_implicito - ccl.valor) / ccl.valor) * 100
      }
    }

    parciales.push({
      ticker,
      instrumento: inst,
      cantidad_neta,
      ppc_ars,
      ppc_usd,
      costo_total_ars,
      costo_total_usd,
      precio_actual_ars,
      precio_actual_usd,
      valor_actual_ars,
      valor_actual_usd,
      pnl_ars,
      pnl_usd,
      pnl_pct_ars,
      pnl_pct_usd,
      precio_teorico_usd,
      descuento_premio_pct,
    })
  }

  for (const p of parciales) {
    tenencias.push({
      ...p,
      peso_cartera: valor_total_ars > 0 ? (p.valor_actual_ars / valor_total_ars) * 100 : 0,
    })
  }

  return tenencias.sort((a, b) => b.valor_actual_ars - a.valor_actual_ars)
}

// ── XIRR (Newton-Raphson) ────────────────────────────────────────────────────

interface Cashflow {
  fecha: Date
  monto: number // negativo = salida, positivo = entrada
}

function xnpv(rate: number, cashflows: Cashflow[]): number {
  const t0 = cashflows[0].fecha.getTime()
  return cashflows.reduce((sum, cf) => {
    const años = (cf.fecha.getTime() - t0) / (365.25 * 24 * 3600 * 1000)
    return sum + cf.monto / Math.pow(1 + rate, años)
  }, 0)
}

export function calcularXIRR(cashflows: Cashflow[]): number | undefined {
  if (cashflows.length < 2) return undefined
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, cashflows)
    const df = xnpv(rate + 1e-6, cashflows)
    const deriv = (df - f) / 1e-6
    if (Math.abs(deriv) < 1e-14) break
    rate = rate - f / deriv
    if (rate <= -1) rate = -0.999
    if (Math.abs(f) < 1e-8) break
  }
  return isFinite(rate) ? rate : undefined
}

export function cashflowsDesdeTransacciones(
  transacciones: Transaccion[],
  valorActual: number,
  moneda: 'ars' | 'usd',
  dividendos: { fecha: string; monto: number; moneda: string }[],
  ccl: CCL,
): Cashflow[] {
  const flows: Cashflow[] = []

  for (const tx of transacciones) {
    const monto_ars = tx.cantidad * tx.precio_unitario + tx.comision
    const monto_usd = monto_ars / tx.ccl_snapshot
    const monto = moneda === 'ars' ? monto_ars : monto_usd
    flows.push({
      fecha: new Date(tx.fecha),
      monto: tx.tipo === 'compra' ? -monto : monto,
    })
  }

  for (const div of dividendos) {
    const monto = moneda === 'ars'
      ? (div.moneda === 'ARS' ? div.monto : div.monto * ccl.valor)
      : (div.moneda === 'USD' ? div.monto : div.monto / ccl.valor)
    flows.push({ fecha: new Date(div.fecha), monto })
  }

  flows.push({ fecha: new Date(), monto: valorActual })

  return flows.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
}
