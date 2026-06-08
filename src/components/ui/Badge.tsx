import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'gray', className, children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    green: 'bg-green-900/50 text-green-400 border-green-800',
    red: 'bg-red-900/50 text-red-400 border-red-800',
    yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    blue: 'bg-blue-900/50 text-blue-400 border-blue-800',
    gray: 'bg-gray-800 text-gray-400 border-gray-700',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
