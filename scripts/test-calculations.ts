// Sanity tests del motor de cálculo — correr con: npx tsx scripts/test-calculations.ts
import { fifoWalk, montoCompra, calcularXIRR, calcularTenencias } from '../src/lib/calculations'
import type { Transaccion, CCL } from '../src/types'

let fallos = 0
function check(nombre: string, real: number, esperado: number, tol = 0.01) {
  const ok = Math.abs(real - esperado) < tol
  if (!ok) fallos++
  console.log(`${ok ? '✓' : '✗ FALLO'} ${nombre}: ${real.toFixed(4)} (esperado ${esperado})`)
}

const tx = (over: Partial<Transaccion>): Transaccion => ({
  id: '1', portfolio_id: 'p', ticker: 'AAPL', tipo: 'compra',
  fecha: '2025-01-15', cantidad: 10, precio_unitario: 20000,
  comision: 1000, ccl_snapshot: 1500, moneda: 'ARS', created_at: '2025-01-15T00:00:00Z',
  ...over,
})

// ── Caso 1: compra ARS con comisión ──
const c1 = montoCompra(tx({}))
check('compra ARS: costo total ARS', c1.ars, 201000)        // 10*20000 + 1000
check('compra ARS: costo total USD', c1.usd, 134)            // 201000/1500

// ── Caso 2: compra cripto en USD (el bug que rompía los rendimientos) ──
const c2 = montoCompra(tx({ ticker: 'BTC', cantidad: 0.1, precio_unitario: 60000, comision: 10, moneda: 'USD' }))
check('compra USD: costo USD', c2.usd, 6010)                 // 0.1*60000 + 10
check('compra USD: costo ARS', c2.ars, 9015000)              // 6010*1500

// ── Caso 3: FIFO con venta parcial (comisión de venta restada) ──
const { lotes, realizado_ars } = fifoWalk([
  tx({}),
  tx({ id: '2', tipo: 'venta', fecha: '2025-03-01', cantidad: 5, precio_unitario: 25000, comision: 500 }),
])
// costo unit: 20100; venta neta unit: (5*25000-500)/5 = 24900 → realizado 5*(24900-20100)
check('FIFO: P&L realizado ARS', realizado_ars, 24000)
check('FIFO: cantidad remanente', lotes.reduce((s, l) => s + l.cantidad, 0), 5)
check('FIFO: costo remanente ARS', lotes.reduce((s, l) => s + l.cantidad * l.costoUnitArs, 0), 100500)

// ── Caso 4: XIRR conocido (-1000 → +1100 en exactamente 1 año ≈ 10%) ──
const xirr = calcularXIRR([
  { fecha: new Date('2024-06-10'), monto: -1000 },
  { fecha: new Date('2025-06-10'), monto: 1100 },
])
check('XIRR 10% anual', (xirr ?? NaN) * 100, 10, 0.1)

// ── Caso 5: tenencia cripto comprada en USD valuada bien ──
const ccl: CCL = { valor: 1500, fecha: '2026-06-10', fuente: 'test' }
const tens = calcularTenencias(
  [tx({ ticker: 'BTC', cantidad: 0.1, precio_unitario: 50000, comision: 0, moneda: 'USD' })],
  { BTC: { usd: 62000, ars: 62000 * 1500, varDiaPct: 2.5 } },
  ccl,
)
check('cripto USD: costo USD', tens[0].costo_total_usd, 5000)
check('cripto USD: valor USD', tens[0].valor_actual_usd, 6200)
check('cripto USD: P&L %', tens[0].pnl_pct_usd, 24)

// ── Caso 6: ratio implícito corrige catálogo desactualizado ──
const tens2 = calcularTenencias(
  [tx({})],
  { AAPL: { ars: 21950, usd: 21950 / 1510.7 } },
  { valor: 1510.7, fecha: '2026-06-10', fuente: 'test' },
  { AAPL: { ticker: 'AAPL', nombre: 'Apple', ratio_cedear: 10, ticker_subyacente: 'AAPL' } }, // catálogo dice 10 (mal)
  { AAPL: { usd: 291 } }, // mercado: subyacente US$291
)
check('ratio implícito usado (real 20:1)', tens2[0].ratio_usado ?? 0, 20)
check('CCL implícito ≈ CCL (±1%)', Math.abs(tens2[0].descuento_premio_pct ?? 99), 0.14, 0.5)

console.log(fallos === 0 ? '\n✅ Todos los tests pasan' : `\n❌ ${fallos} fallos`)
process.exit(fallos === 0 ? 0 : 1)
