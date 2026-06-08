export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatUSD(valor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function formatPct(valor: number, decimales = 1): string {
  const sign = valor > 0 ? '+' : ''
  return `${sign}${valor.toFixed(decimales)}%`
}

export function formatCompacto(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) return `${(valor / 1_000_000).toFixed(1)}M`
  if (Math.abs(valor) >= 1_000) return `${(valor / 1_000).toFixed(0)}K`
  return valor.toFixed(0)
}
