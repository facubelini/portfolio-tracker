import { useQuery } from '@tanstack/react-query'
import { getCCL, getMEP } from '../lib/api/dolarapi'
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
