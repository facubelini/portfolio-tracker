export type PortfolioTipo = 'cedear' | 'cripto'
export type TransaccionTipo = 'compra' | 'venta'
export type Moneda = 'ARS' | 'USD'

export interface Portfolio {
  id: string
  user_id: string
  nombre: string
  tipo: PortfolioTipo
  created_at: string
}

export interface Transaccion {
  id: string
  portfolio_id: string
  ticker: string
  tipo: TransaccionTipo
  fecha: string
  cantidad: number
  precio_unitario: number
  comision: number
  ccl_snapshot: number
  moneda: Moneda
  notas?: string
  created_at: string
}

export interface Dividendo {
  id: string
  portfolio_id: string
  ticker: string
  fecha: string
  monto: number
  moneda: Moneda
}

export interface Instrumento {
  ticker: string
  nombre: string
  ratio_cedear?: number
  ticker_subyacente?: string
  sector?: string
  pais?: string
}

export interface Tenencia {
  ticker: string
  instrumento?: Instrumento
  cantidad_neta: number
  ppc_ars: number
  ppc_usd: number
  costo_total_ars: number
  costo_total_usd: number
  precio_actual_ars: number
  precio_actual_usd: number
  valor_actual_ars: number
  valor_actual_usd: number
  pnl_ars: number
  pnl_usd: number
  pnl_pct_ars: number
  pnl_pct_usd: number
  peso_cartera: number
  precio_teorico_usd?: number
  descuento_premio_pct?: number
}

export interface ResumenPortfolio {
  valor_ars: number
  valor_usd: number
  costo_ars: number
  costo_usd: number
  pnl_ars: number
  pnl_usd: number
  pnl_pct_ars: number
  pnl_pct_usd: number
  xirr_ars?: number
  xirr_usd?: number
  dividendos_ars: number
  dividendos_usd: number
}

export interface PrecioMercado {
  ticker: string
  precio_ars?: number
  precio_usd?: number
  variacion_dia_pct?: number
}

export interface CCL {
  valor: number
  fecha: string
  fuente: string
}
