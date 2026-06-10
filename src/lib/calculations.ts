import type { Transaccion, Tenencia, Instrumento, CCL, MapaPrecios } from '../types'

// ── Montos según moneda de la transacción ───────────────────────────────────
// precio_unitario está expresado en tx.moneda; ccl_snapshot convierte ARS↔USD.

export function montoCompra(tx: Transaccion): { ars: number; usd: number } {
  if (tx.moneda === 'USD') {
    const usd = tx.cantidad * tx.precio_unitario + tx.comision
    return { ars: usd * tx.ccl_snapshot, usd }
  }
  const ars = tx.cantidad * tx.precio_unitario + tx.comision
  return { ars, usd: ars / tx.ccl_snapshot }
}

// Venta: la comisión se descuenta del producido
export function montoVenta(tx: Transaccion): { ars: number; usd: number } {
  if (tx.moneda === 'USD') {
    const usd = tx.cantidad * tx.precio_unitario - tx.comision
    return { ars: usd * tx.ccl_snapshot, usd }
  }
  const ars = tx.cantidad * tx.precio_unitario - tx.comision
  return { ars, usd: ars / tx.ccl_snapshot }
}

// ── FIFO: lotes remanentes + P&L realizado ──────────────────────────────────

export interface Lote {
  cantidad: number
  costoUnitArs: number
  costoUnitUsd: number
}

export function fifoWalk(transacciones: Transaccion[]): {
  lotes: Lote[]
  realizado_ars: number
  realizado_usd: number
} {
  const lotes: Lote[] = []
  let realizado_ars = 0
  let realizado_usd = 0

  const ordenadas = [...transacciones].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )

  for (const tx of ordenadas) {
    if (tx.tipo === 'compra') {
      const { ars, usd } = montoCompra(tx)
      lotes.push({
        cantidad: tx.cantidad,
        costoUnitArs: ars / tx.cantidad,
        costoUnitUsd: usd / tx.cantidad,
      })
    } else {
      const { ars, usd } = montoVenta(tx)
      const ventaUnitArs = ars / tx.cantidad
      const ventaUnitUsd = usd / tx.cantidad
      let restante = tx.cantidad
      while (restante > 1e-12 && lotes.length > 0) {
        const lote = lotes[0]
        const usado = Math.min(restante, lote.cantidad)
        realizado_ars += usado * (ventaUnitArs - lote.costoUnitArs)
        realizado_usd += usado * (ventaUnitUsd - lote.costoUnitUsd)
        lote.cantidad -= usado
        restante -= usado
        if (lote.cantidad <= 1e-12) lotes.shift()
      }
    }
  }

  return { lotes, realizado_ars, realizado_usd }
}

// ── Tenencias desde transacciones ───────────────────────────────────────────

export function calcularTenencias(
  transacciones: Transaccion[],
  precios: MapaPrecios,
  ccl: CCL,
  instrumentos: Record<string, Instrumento> = {},
  preciosSubyacentes: MapaPrecios = {},
): Tenencia[] {
  const byTicker: Record<string, Transaccion[]> = {}
  for (const tx of transacciones) {
    ;(byTicker[tx.ticker] ??= []).push(tx)
  }

  const parciales: Omit<Tenencia, 'peso_cartera'>[] = []
  let valor_total_ars = 0

  for (const [ticker, txs] of Object.entries(byTicker)) {
    // PPC sobre lo que aún se tiene (lotes FIFO remanentes), no sobre todas las compras
    const { lotes } = fifoWalk(txs)
    const cantidad_neta = lotes.reduce((s, l) => s + l.cantidad, 0)
    if (cantidad_neta <= 1e-9) continue

    const costo_total_ars = lotes.reduce((s, l) => s + l.cantidad * l.costoUnitArs, 0)
    const costo_total_usd = lotes.reduce((s, l) => s + l.cantidad * l.costoUnitUsd, 0)
    const ppc_ars = costo_total_ars / cantidad_neta
    const ppc_usd = costo_total_usd / cantidad_neta

    const p = precios[ticker] ?? {}
    const precio_actual_ars = p.ars ?? (p.usd != null ? p.usd * ccl.valor : 0)
    const precio_actual_usd = p.usd ?? (p.ars != null ? p.ars / ccl.valor : 0)

    const valor_actual_ars = cantidad_neta * precio_actual_ars
    const valor_actual_usd = cantidad_neta * precio_actual_usd
    valor_total_ars += valor_actual_ars

    const pnl_ars = valor_actual_ars - costo_total_ars
    const pnl_usd = valor_actual_usd - costo_total_usd

    // Variación del día → cambio en $ de la posición
    const varDia = p.varDiaPct
    const conVar = varDia != null && varDia > -100
    const cambio_dia_ars = conVar ? valor_actual_ars - valor_actual_ars / (1 + varDia / 100) : undefined
    const cambio_dia_usd = conVar ? valor_actual_usd - valor_actual_usd / (1 + varDia / 100) : undefined

    // Precio teórico del CEDEAR vía subyacente US.
    // El ratio del catálogo puede estar desactualizado (cambia con splits): si el
    // ratio implícito del mercado difiere del catálogo, prevalece el implícito —
    // el arbitraje mantiene el CCL implícito a pocos % del CCL real.
    const inst = instrumentos[ticker]
    let precio_teorico_usd: number | undefined
    let descuento_premio_pct: number | undefined
    let ratio_usado: number | undefined = inst?.ratio_cedear ?? undefined

    const subTicker = inst?.ticker_subyacente ?? ticker
    const subUsd = preciosSubyacentes[subTicker]?.usd
    if (subUsd && precio_actual_ars > 0) {
      const ratioImplicito = Math.round((subUsd * ccl.valor) / precio_actual_ars)
      if (ratioImplicito >= 1) {
        if (!ratio_usado || Math.abs(ratioImplicito - ratio_usado) >= 1) {
          ratio_usado = ratioImplicito
        }
        precio_teorico_usd = subUsd / ratio_usado
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
      pnl_pct_ars: costo_total_ars > 0 ? (pnl_ars / costo_total_ars) * 100 : 0,
      pnl_pct_usd: costo_total_usd > 0 ? (pnl_usd / costo_total_usd) * 100 : 0,
      precio_teorico_usd,
      descuento_premio_pct,
      variacion_dia_pct: varDia,
      cambio_dia_ars,
      cambio_dia_usd,
      ratio_usado,
    })
  }

  return parciales
    .map(p => ({
      ...p,
      peso_cartera: valor_total_ars > 0 ? (p.valor_actual_ars / valor_total_ars) * 100 : 0,
    }))
    .sort((a, b) => b.valor_actual_ars - a.valor_actual_ars)
}

// ── XIRR (Newton-Raphson con fallback de bisección) ─────────────────────────

export interface Cashflow {
  fecha: Date
  monto: number // negativo = salida (compra), positivo = entrada (venta/dividendo/valor final)
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
  if (!cashflows.some(c => c.monto > 0) || !cashflows.some(c => c.monto < 0)) return undefined

  const escala = cashflows.reduce((s, c) => s + Math.abs(c.monto), 0)
  const tol = escala * 1e-9 + 1e-6

  // Newton-Raphson
  let rate = 0.1
  for (let i = 0; i < 50; i++) {
    const f = xnpv(rate, cashflows)
    if (Math.abs(f) < tol) break
    const f2 = xnpv(rate + 1e-7, cashflows)
    const deriv = (f2 - f) / 1e-7
    if (Math.abs(deriv) < 1e-14) break
    const next = rate - f / deriv
    rate = next <= -1 ? (rate - 1) / 2 : next
  }
  if (isFinite(rate) && rate > -1 && Math.abs(xnpv(rate, cashflows)) < tol * 10) {
    return rate
  }

  // Bisección en (-0.9999, 10)
  let lo = -0.9999
  let hi = 10
  let flo = xnpv(lo, cashflows)
  const fhi = xnpv(hi, cashflows)
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return undefined
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fm = xnpv(mid, cashflows)
    if (Math.abs(fm) < tol || hi - lo < 1e-9) return mid
    if (flo * fm < 0) {
      hi = mid
    } else {
      lo = mid
      flo = fm
    }
  }
  return (lo + hi) / 2
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
    const m = tx.tipo === 'compra' ? montoCompra(tx) : montoVenta(tx)
    const monto = moneda === 'ars' ? m.ars : m.usd
    flows.push({
      fecha: new Date(tx.fecha),
      monto: tx.tipo === 'compra' ? -monto : monto,
    })
  }

  for (const div of dividendos) {
    const monto =
      moneda === 'ars'
        ? div.moneda === 'ARS' ? div.monto : div.monto * ccl.valor
        : div.moneda === 'USD' ? div.monto : div.monto / ccl.valor
    flows.push({ fecha: new Date(div.fecha), monto })
  }

  flows.push({ fecha: new Date(), monto: valorActual })

  return flows.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
}
