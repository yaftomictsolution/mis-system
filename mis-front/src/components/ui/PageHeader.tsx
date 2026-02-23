'use client'

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 mt-1 font-mono text-sm">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-3">{children}</div>}
    </div>
  )
}
