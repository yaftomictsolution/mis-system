'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color: 'blue' | 'amber' | 'emerald' | 'orange' | 'red' | 'purple' | 'slate'
  trend?: { value: string; isPositive: boolean }
  delay?: number
  to?: string
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/50',
  amber: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/50',
  emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/50',
  orange: 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/50',
  red: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/50',
  purple: 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/50',
  slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/50',
}

const accentBar = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  slate: 'bg-slate-500',
}

function AnimatedValue({ value }: { value: string | number }) {
  const strVal = String(value)
  const numericMatch = strVal.match(/[\d,.]+/)
  const hasNumericMatch = Boolean(numericMatch)
  const numStr = numericMatch?.[0].replace(/,/g, '') ?? '0'
  const targetNum = parseFloat(numStr)
  const prefix = strVal.substring(0, numericMatch?.index ?? 0)
  const suffix = strVal.substring((numericMatch?.index ?? 0) + (numericMatch?.[0].length ?? 0))
  const hasDecimal = numStr.includes('.')
  const decimalPlaces = hasDecimal ? (numStr.split('.')[1]?.length ?? 0) : 0
  const [displayNum, setDisplayNum] = useState(0)
  useEffect(() => {
    const duration = 1200
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplayNum(targetNum * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [targetNum])
  if (!hasNumericMatch) return <span>{value}</span>
  const formatted = hasDecimal ? displayNum.toFixed(decimalPlaces) : Math.round(displayNum).toLocaleString()
  return <span>{prefix}{formatted}{suffix}</span>
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  delay = 0,
  to = '#',
}: StatCardProps) {
  const className = `block bg-white dark:bg-[#12121a] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] p-5 sm:p-6 h-full relative overflow-hidden group ${to !== '#' ? 'cursor-pointer' : ''}`

  const inner = (
    <>
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentBar[color]}`} />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedValue value={value} />
          </h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center mt-3 text-xs font-semibold ${trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-1.5 ${trend.isPositive ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-red-100 dark:bg-red-500/15'}`}>
                {trend.isPositive ? '↑' : '↓'}
              </span>
              {trend.value}
              <span className="text-slate-400 font-normal ml-1.5">vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl border ${colorMap[color]} transition-all duration-300 group-hover:scale-110`}>
          <Icon size={20} />
        </div>
      </div>
      {to !== '#' && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          <ArrowRight size={16} className="text-slate-400" />
        </div>
      )}
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {to !== '#' ? <Link href={to} className={className}>{inner}</Link> : <div className={className}>{inner}</div>}
    </motion.div>
  )
}
