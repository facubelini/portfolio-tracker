// argentinadatos.com — serie histórica completa de cotizaciones del dólar
// CORS habilitado (verificado). Serie CCL desde 2013 hasta hoy, un registro por día hábil.

export interface CotizacionDia {
  casa: string
  compra: number
  venta: number
  fecha: string // YYYY-MM-DD
}

export async function getSerieCCL(): Promise<CotizacionDia[]> {
  const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui')
  if (!res.ok) throw new Error(`argentinadatos CCL: HTTP ${res.status}`)
  return res.json()
}

// Valor de la serie en la fecha dada (o el día hábil anterior más cercano).
// La serie viene ordenada ascendente por fecha; búsqueda binaria.
export function valorEnFecha(serie: CotizacionDia[], fechaISO: string): number | null {
  if (serie.length === 0) return null
  let lo = 0
  let hi = serie.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (serie[mid].fecha <= fechaISO) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best === -1) return serie[0].venta // fecha anterior al inicio de la serie
  return serie[best].venta
}
