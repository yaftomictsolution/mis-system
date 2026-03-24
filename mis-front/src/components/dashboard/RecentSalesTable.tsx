'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { DashboardRecentSale } from './useDashboardData'

const statusStyles: Record<string, string> = {
  Completed: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  Active: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  Pending: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  Cancelled: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

type RecentSalesTableProps = {
  sales: DashboardRecentSale[]
}

export function RecentSalesTable({ sales }: RecentSalesTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-white dark:bg-[#12121a] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] overflow-hidden"
    >
      <div className="p-6 border-b border-slate-200 dark:border-[#2a2a3e] flex justify-between items-center bg-white dark:bg-[#12121a]">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Sales</h3>
        <Link
          href="/apartment-sales"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium flex items-center transition-colors"
        >
          View All <ArrowUpRight size={16} className="ml-1" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-[#0a0a0f] text-slate-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4 font-bold">Customer</th>
              <th className="px-6 py-4 font-bold">Apartment</th>
              <th className="px-6 py-4 font-bold">Amount</th>
              <th className="px-6 py-4 font-bold">Date</th>
              <th className="px-6 py-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#2a2a3e]">
            {sales.length ? (
              sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-slate-50 dark:hover:bg-[#1a1a2e] transition-colors group"
                >
                  <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
                    <Link href={sale.href} className="hover:underline">
                      {sale.customer}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-400">
                    {sale.apartment}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200 font-mono">{sale.amount}</td>
                  <td className="px-6 py-4 text-slate-500">{sale.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyles[sale.status] ?? statusStyles.Active}`}>
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                  No sales have been synced yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
