import { useQuery } from '@tanstack/react-query'
import { getCCL, getMEP } from '../lib/api/dolarapi'
import { getSerieCCL } from '../lib/api/argentinadatos'
import type { CCL } from '../types'

export function useCCL() {
  return useQuery<CCL>({
    queryKey: ['ccl'],
    queryFn: async () => {
      // dolarapi.com es la fuente principal — devuelve CCL confiable
      try {
        return await getCCL()
      } catch {
        // fallback a MEP si CCL falla
        return getMEP()
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

// Serie histórica completa del CCL (2013→hoy) — para autocompletar ccl_snapshot
// por fecha y para la curva de equity del benchmark
export function useCCLHistorico() {
  return useQuery({
    queryKey: ['ccl-historico'],
    queryFn: getSerieCCL,
    staleTime: 6 * 3_600_000,
  })
}
