import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Transaccion } from '../types'

export function useTransacciones(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['transacciones', portfolioId],
    enabled: !!portfolioId,
    queryFn: async (): Promise<Transaccion[]> => {
      const { data, error } = await supabase
        .from('transacciones')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('fecha')
      if (error) throw error
      return data
    },
  })
}

export function useAgregarTransaccion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tx: Omit<Transaccion, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('transacciones')
        .insert(tx)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['transacciones', vars.portfolio_id] }),
  })
}

export function useEliminarTransaccion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolioId }: { id: string; portfolioId: string }) => {
      const { error } = await supabase.from('transacciones').delete().eq('id', id)
      if (error) throw error
      return portfolioId
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['transacciones', vars.portfolioId] }),
  })
}
