import type { CCL } from '../../types'

const BASE = 'https://dolarapi.com/v1'

export interface DolarApiResponse {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

async function fetchDolar(casa: string): Promise<DolarApiResponse> {
  const res = await fetch(`${BASE}/dolares/${casa}`)
  if (!res.ok) throw new Error(`dolarapi ${casa}: ${res.status}`)
  return res.json()
}

export async function getCCL(): Promise<CCL> {
  const data = await fetchDolar('contadoconliqui')
  return {
    valor: data.venta,
    fecha: data.fechaActualizacion,
    fuente: 'dolarapi/ccl',
  }
}

export async function getMEP(): Promise<CCL> {
  const data = await fetchDolar('bolsa')
  return {
    valor: data.venta,
    fecha: data.fechaActualizacion,
    fuente: 'dolarapi/mep',
  }
}

export async function getBlue(): Promise<DolarApiResponse> {
  return fetchDolar('blue')
}

export async function getOficial(): Promise<DolarApiResponse> {
  return fetchDolar('oficial')
}
