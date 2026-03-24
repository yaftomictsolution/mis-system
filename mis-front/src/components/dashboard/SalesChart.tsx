'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { motion } from 'framer-motion'
import { useTheme } from '../../../app/context/ThemeContext'
import type { DashboardSalesPoint } from './useDashboardData'

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toString()
}

type SalesChartProps = {
  data: DashboardSalesPoint[]
}

export function SalesChart({ data }: SalesChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white dark:bg-[#12121a] p-6 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] h-[400px] flex flex-col"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Monthly Sales Revenue</h3>
        <p className="text-sm text-slate-500">Revenue performance over the last 6 months</p>
      </div>
      <div className="flex-1 w-full min-h-0">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2a2a3e' : '#e2e8f0'} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(26, 26, 46, 0.5)' : 'rgba(241, 245, 249, 0.5)' }}
                contentStyle={{
                  backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #2a2a3e' : '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  color: isDark ? '#e2e8f0' : '#0f172a',
                }}
                itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number | undefined) => [value != null ? `AFN ${Math.round(value).toLocaleString()}` : '', 'Revenue']}
              />
              <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-[#2a2a3e] dark:text-slate-400">
            No sales data available yet.
          </div>
        )}
      </div>
    </motion.div>
  )
}
