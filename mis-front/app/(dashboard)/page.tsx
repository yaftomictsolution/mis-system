"use client";
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Plus,
} from 'lucide-react'

export default function DashboardHome() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="relative p-4 lg:p-8 max-w-[1600px] mx-auto space-y-8 min-h-full">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none z-0" />

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back, tahir khan
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-slate-500 mt-1 font-mono text-sm">
              {today}
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex gap-3">
            <button type="button" className="px-4 py-2 bg-white dark:bg-[#1a1a2e] border border-slate-200 dark:border-[#2a2a3e] rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2a2a3e] transition-colors shadow-sm">
              Download Report
            </button>
            <Link href="/dashboard/sales" className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 border border-amber-400/50 flex items-center gap-2">
              <Plus size={16} /> New Sale
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
