import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Portfolio } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useCrearPortfolio, useEliminarPortfolio } from '../../hooks/usePortfolios'

interface Props {
  portfolios: Portfolio[]
  selected: string | null
  onSelect: (id: string) => void
}

export function PortfolioTabs({ portfolios, selected, onSelect }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'cedear' | 'cripto'>('cedear')
  const crear = useCrearPortfolio()
  const eliminar = useEliminarPortfolio()

  async function handleCrear() {
    if (!nombre.trim()) return
    const p = await crear.mutateAsync({ nombre: nombre.trim(), tipo })
    onSelect(p.id)
    setNombre('')
    setShowNew(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {portfolios.map(p => (
        <div key={p.id} className="flex items-center gap-0">
          <button
            onClick={() => onSelect(p.id)}
            className={cn(
              'px-3 py-1.5 rounded-l-lg text-sm transition-colors border',
              selected === p.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-100 hover:bg-gray-800',
            )}
          >
            {p.tipo === 'cedear' ? '🇦🇷' : '₿'} {p.nombre}
          </button>
          <button
            onClick={() => {
              if (confirm(`Eliminar "${p.nombre}"? Esto borrará todas sus transacciones.`)) {
                eliminar.mutate(p.id)
                if (selected === p.id && portfolios.length > 1) {
                  onSelect(portfolios.find(x => x.id !== p.id)!.id)
                }
              }
            }}
            className={cn(
              'px-1.5 py-1.5 rounded-r-lg text-sm transition-colors border-y border-r',
              selected === p.id
                ? 'bg-blue-700 text-blue-200 border-blue-600 hover:bg-blue-800'
                : 'bg-gray-900 text-gray-600 border-gray-800 hover:text-red-400 hover:bg-gray-800',
            )}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}

      {showNew ? (
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5">
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre"
            className="!py-0.5 !px-2 text-xs w-28"
            onKeyDown={e => e.key === 'Enter' && handleCrear()}
            autoFocus
          />
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as 'cedear' | 'cripto')}
            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-300"
          >
            <option value="cedear">CEDEARs</option>
            <option value="cripto">Cripto</option>
          </select>
          <Button size="sm" onClick={handleCrear} loading={crear.isPending}>OK</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>✕</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> Nuevo
        </Button>
      )}
    </div>
  )
}
