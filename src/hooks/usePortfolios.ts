import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Portfolio, PortfolioTipo } from '../types'

export function usePortfolios() {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: async (): Promise<Portfolio[]> => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCrearPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nombre, tipo }: { nombre: string; tipo: PortfolioTipo }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data, error } = await supabase
        .from('portfolios')
        .insert({ nombre, tipo, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolios'] }),
  })
}

export function useEliminarPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portfolios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolios'] }),
  })
}
