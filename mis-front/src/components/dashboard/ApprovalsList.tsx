'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, FileText } from 'lucide-react'
import Link from 'next/link'
import type { DashboardApproval } from './useDashboardData'

type ApprovalsListProps = {
  approvals: DashboardApproval[]
}

export function ApprovalsList({ approvals }: ApprovalsListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-white dark:bg-[#12121a] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] flex flex-col h-full"
    >
      <div className="p-6 border-b border-slate-200 dark:border-[#2a2a3e] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pending Approvals</h3>
          <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
            {approvals.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#2a2a3e]">
        {approvals.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0a0a0f]/50 rounded-lg border border-slate-200 dark:border-[#2a2a3e] hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white dark:bg-[#1a1a2e] rounded-md border border-slate-200 dark:border-[#2a2a3e] mt-1 shadow-sm">
                <FileText size={18} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {item.desc}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">By {item.requester} - {item.time}</p>
              </div>
            </div>
            <Link
              href={item.href ?? '/apartment-sales'}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-[#2a2a3e] dark:bg-[#1a1a2e] dark:text-slate-300 dark:hover:bg-[#2a2a3e] dark:hover:text-white"
            >
              Review <ArrowUpRight size={14} />
            </Link>
          </motion.div>
        ))}
        {approvals.length === 0 && (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">No pending approvals.</div>
        )}
      </div>
    </motion.div>
  )
}
