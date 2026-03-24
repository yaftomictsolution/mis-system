'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { motion } from 'framer-motion'
import { useTheme } from '../../../app/context/ThemeContext'
import type { DashboardStatusPoint } from './useDashboardData'

type ApartmentStatusChartProps = {
  data: DashboardStatusPoint[]
}

export function ApartmentStatusChart({ data }: ApartmentStatusChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white dark:bg-[#12121a] p-6 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] h-[400px] flex flex-col"
    >
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Apartment Status</h3>
        <p className="text-sm text-slate-500">Current distribution of units</p>
      </div>
      <div className="flex-1 w-full min-h-0 relative">
        {data.length ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{total}</span>
              <span className="text-sm text-slate-500">Total Units</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #2a2a3e' : '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: isDark ? '#e2e8f0' : '#0f172a',
                  }}
                  itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="ml-1 font-medium text-slate-600 dark:text-slate-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-[#2a2a3e] dark:text-slate-400">
            No apartment status data available yet.
          </div>
        )}
      </div>
    </motion.div>
  )
}
