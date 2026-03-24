'use client'

import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import Link from 'next/link'
import type { DashboardProgressItem } from './useDashboardData'

const getProgressColor = (progress: number) => {
  if (progress < 25) return 'bg-slate-500'
  if (progress < 50) return 'bg-amber-500'
  if (progress < 80) return 'bg-blue-500'
  return 'bg-emerald-500'
}

type ProjectProgressProps = {
  title?: string
  items: DashboardProgressItem[]
  viewAllHref?: string
}

export function ProjectProgress({
  title = 'Active Portfolio',
  items,
  viewAllHref = '/rentals',
}: ProjectProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="bg-white dark:bg-[#12121a] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] p-6"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <Link href={viewAllHref} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-6">
        {items.length ? (
          items.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center text-xs text-slate-500 mt-0.5">
                    <MapPin size={12} className="mr-1" />
                    {item.location}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300 font-mono">{item.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#1a1a2e] rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor(item.progress)} shadow-[0_0_8px_currentColor]`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{item.status}</div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-[#2a2a3e] dark:text-slate-400">
            No portfolio data available yet.
          </div>
        )}
      </div>
    </motion.div>
  )
}
