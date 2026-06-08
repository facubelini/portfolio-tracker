import { useQuery } from '@tanstack/react-query'
import { getCCL } from '../lib/api/dolarapi'
import { getCCLdesdeData912 } from '../lib/api/data912'
import type { CCL } from '../types'

export function useCCL() {
  return useQuery<CCL>({
    queryKey: ['ccl'],
    queryFn: async () => {
      try {
        return await getCCLdesdeData912()
      } catch {
        return getCCL()
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
