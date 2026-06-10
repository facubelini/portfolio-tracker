import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Instrumento } from '../types'

// Catálogo de instrumentos (ratio CEDEAR, subyacente, sector) → mapa por ticker
export function useInstrumentos() {
  return useQuery<Record<string, Instrumento>>({
    queryKey: ['instrumentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('instrumentos').select('*')
      if (error) throw error
      return Object.fromEntries((data as Instrumento[]).map(i => [i.ticker, i]))
    },
    staleTime: 3_600_000,
  })
}
