"use client";

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useSelector } from 'react-redux'

import {
  Building2,
  FolderKanban,
  TrendingUp,
  ClipboardCheck,
  AlertTriangle,
  Landmark,
  Plus,
  Users,
  Zap,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { ApartmentStatusChart } from '@/components/dashboard/ApartmentStatusChart'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { RecentSalesTable } from '@/components/dashboard/RecentSalesTable'
import { ApprovalsList } from '@/components/dashboard/ApprovalsList'
import { ProjectProgress } from '@/components/dashboard/ProjectProgress'
import { useDashboardData, type DashboardApprovalQueue } from '@/components/dashboard/useDashboardData'
import { hasAnyRole } from '@/lib/permissions'
import type { RootState } from '@/store/store'

const activityColors: Record<string, string> = {
  sale: 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
  milestone: 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  payment: 'border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]',
  document: 'border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]',
  alert: 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }
const assetQueueIconMap = {
  asset_waiting_approval: ClipboardCheck,
  asset_ready_allocate: FolderKanban,
  asset_allocated: Zap,
} as const

function formatCurrencyShort(amount: number): string {
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000_000) return `USD ${(amount / 1_000_000_000).toFixed(1)}B`
  if (absolute >= 1_000_000) return `USD ${(amount / 1_000_000).toFixed(1)}M`
  if (absolute >= 1_000) return `USD ${(amount / 1_000).toFixed(0)}K`
  return `USD ${Math.round(amount).toLocaleString()}`
}

function buildTrend(current: number, previous: number): { value: string; isPositive: boolean } | undefined {
  if (previous <= 0) return undefined
  const delta = ((current - previous) / previous) * 100
  return {
    value: `${Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)}%`,
    isPositive: delta >= 0,
  }
}

function toDisplayName(user: RootState["auth"]["user"]): string {
  const fullName = String(user?.full_name ?? '').trim()
  if (fullName) {
    return fullName.charAt(0).toUpperCase() + fullName.slice(1)
  }

  const emailLocalPart = String(user?.email ?? '').trim().split('@')[0]?.trim() || ''
  if (emailLocalPart) {
    return emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1)
  }

  return 'User'
}

function getPreferredQueueKey(
  user: RootState["auth"]["user"],
  queues: DashboardApprovalQueue[],
): DashboardApprovalQueue['key'] | null {
  const roles = user?.roles ?? []
  if (hasAnyRole(roles, 'Admin') && queues.some((queue) => queue.key === 'admin')) return 'admin'
  if (hasAnyRole(roles, 'Storekeeper') && queues.some((queue) => queue.key === 'storekeeper')) return 'storekeeper'
  if (hasAnyRole(roles, 'Accountant') && queues.some((queue) => queue.key === 'finance')) return 'finance'
  return queues[0]?.key ?? null
}

export default function DashboardHome() {
  const dashboard = useDashboardData()
  const user = useSelector((state: RootState) => state.auth.user)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const displayName = toDisplayName(user)
  const revenueTrend = buildTrend(dashboard.summary.currentMonthRevenue, dashboard.summary.previousMonthRevenue)
  const preferredQueueKey = getPreferredQueueKey(user, dashboard.approvalQueues)
  const primaryQueue = dashboard.approvalQueues.find((queue) => queue.key === preferredQueueKey) ?? dashboard.approvalQueues[0]
  const workflowCount = primaryQueue?.count ?? dashboard.summary.pendingApprovals
  const workflowSubtitle = primaryQueue?.helperText || (workflowCount ? 'Items are waiting for your next action.' : 'No workflow items are waiting.')
  const workflowHref = primaryQueue?.items[0]?.href || (primaryQueue?.key === 'finance' ? '/purchase-requests' : primaryQueue?.key === 'storekeeper' ? '/inventory-requests' : '/apartment-sales')

  return (
    <div className="relative p-4 lg:p-8 max-w-[1600px] mx-auto space-y-8 min-h-full">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none z-0" />

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {displayName}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-slate-500 mt-1 font-mono text-sm">
              {today}
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                void dashboard.refresh()
              }}
              className="px-4 py-2 bg-white dark:bg-[#1a1a2e] border border-slate-200 dark:border-[#2a2a3e] rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2a2a3e] transition-colors shadow-sm"
            >
              {dashboard.loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <Link href="/apartment-sales" className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 border border-amber-400/50 flex items-center gap-2">
              <Plus size={16} /> New Sale
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatCard
            title="Total Apartments"
            value={dashboard.summary.totalApartments}
            subtitle={`${dashboard.summary.availableApartments} Available - ${dashboard.summary.soldApartments} Sold`}
            icon={Building2}
            color="blue"
            delay={0.1}
            to="/apartments"
          />
          <StatCard
            title="Total Customers"
            value={dashboard.summary.totalCustomers}
            subtitle={`${dashboard.recentSales.length} recent sales linked`}
            icon={Users}
            color="amber"
            delay={0.2}
            to="/customers"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrencyShort(dashboard.summary.totalRevenue)}
            subtitle={`This month: ${formatCurrencyShort(dashboard.summary.currentMonthRevenue)}`}
            icon={TrendingUp}
            color="emerald"
            trend={revenueTrend}
            delay={0.3}
            to="/apartment-sales"
          />
          <StatCard
            title={primaryQueue ? `${primaryQueue.label} Queue` : 'Pending Approvals'}
            value={workflowCount}
            subtitle={workflowSubtitle}
            icon={ClipboardCheck}
            color="orange"
            delay={0.4}
            to={workflowHref}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <StatCard
            title="Overdue Installments"
            value={dashboard.summary.overdueInstallments}
            subtitle={`Total value: ${formatCurrencyShort(dashboard.summary.overdueAmount)}`}
            icon={AlertTriangle}
            color="red"
            delay={0.5}
            to="/installments"
          />
          <StatCard
            title="Municipality Pending"
            value={formatCurrencyShort(dashboard.summary.municipalityPending)}
            subtitle={`${dashboard.summary.municipalityPendingCount} records awaiting settlement`}
            icon={Landmark}
            color="purple"
            delay={0.6}
            to="/apartment-sales"
          />
          <StatCard
            title="Active Rentals"
            value={dashboard.summary.activeRentals}
            subtitle={`${dashboard.summary.rentalsDueSoon} payments due within 7 days`}
            icon={FolderKanban}
            color="slate"
            delay={0.7}
            to="/rentals"
          />
        </div>

        {dashboard.assetRequestQueueCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Asset Request Queue</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Dedicated approval and allocation shortcuts for asset workflow only.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {dashboard.assetRequestQueueCards.map((card, index) => {
                const icon = assetQueueIconMap[card.id]
                return (
                  <StatCard
                    key={card.id}
                    title={card.label}
                    value={card.count}
                    subtitle={card.helperText}
                    icon={icon}
                    color={card.color}
                    delay={0.72 + index * 0.04}
                    to={card.href}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><SalesChart data={dashboard.salesChartData} /></div>
          <div><ApartmentStatusChart data={dashboard.apartmentStatusData} /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentSalesTable sales={dashboard.recentSales} />
          <ApprovalsList approvals={dashboard.approvals} approvalQueues={dashboard.approvalQueues} preferredQueueKey={preferredQueueKey} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ProjectProgress title="Rental Portfolio" items={dashboard.progressItems} viewAllHref="/rentals" />
          </div>
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="bg-white dark:bg-[#12121a] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-[#2a2a3e] p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Local snapshot</span>
              </div>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5 relative before:absolute before:inset-y-0 before:left-[7px] before:w-0.5 before:bg-slate-200 dark:before:bg-[#2a2a3e]">
                {dashboard.activities.length ? (
                  dashboard.activities.map((activity) => (
                    <motion.div key={activity.id} variants={fadeUp} className="relative pl-8 group cursor-default">
                      <div className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white dark:bg-[#12121a] border-2 ${activityColors[activity.type]} group-hover:scale-125 transition-transform duration-200`} />
                      <p className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-relaxed">{activity.text}</p>
                      <p className="text-xs text-slate-400 mt-1 font-mono">{activity.user} - {activity.time}</p>
                    </motion.div>
                  ))
                ) : (
                  <motion.div variants={fadeUp} className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-white dark:bg-[#12121a] border-2 border-slate-300 dark:border-[#2a2a3e]" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity available yet.</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {dashboard.metrics.map((metric, i) => (
            <motion.div key={metric.label} variants={fadeUp} className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-[#2a2a3e] p-4 rounded-xl shadow-sm">
              <div className="flex justify-between items-end mb-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{metric.label}</span>
                <span className={`text-xl font-mono font-bold ${metric.color}`}>{metric.value}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: metric.width }} transition={{ duration: 1, delay: 0.8 + i * 0.15, ease: 'easeOut' }} className={`h-full ${metric.bar} rounded-full`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
