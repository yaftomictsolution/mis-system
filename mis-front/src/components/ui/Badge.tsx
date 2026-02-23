'use client'

import type { ReactNode } from 'react'

const colorStyles: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20',
}

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'outline'
  className?: string
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'slate'
}

export function Badge({
  children,
  className = '',
  color = 'blue',
}: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles[color]} ${className}`}>
      {children}
    </span>
  )
}
