import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Dividendo } from '../types'

export function useDividendos(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['dividendos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async (): Promise<Dividendo[]> => {
      const { data, error } = await supabase
        .from('dividendos')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('fecha', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAgregarDividendo(portfolioId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: Omit<Dividendo, 'id'>) => {
      const { data, error } = await supabase.from('dividendos').insert(d).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dividendos', portfolioId] }),
  })
}

export function useEliminarDividendo(portfolioId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dividendos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dividendos', portfolioId] }),
  })
}
