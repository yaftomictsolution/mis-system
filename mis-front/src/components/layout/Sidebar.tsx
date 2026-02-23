"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncWidget } from "@/sync/useSyncWidget";
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from "@/store/store";
import { setSidebarOpen } from '../../store/uiSlice'
import { NAV_ITEMS } from "@/config/nav";



export default function Sidebar() {
  
  const pathname = usePathname();
  const perms: string[] = useSelector((s: RootState) => s.auth.user?.permissions || []);
  const groups = NAV_ITEMS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const permission = "permission" in item ? item.permission : undefined;
        return typeof permission !== "string" || perms.includes(permission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const dispatch = useDispatch()
  const { sidebarOpen, isMobile } = useSelector((state: RootState) => state.ui)
  const { online,queueCount, syncing,storage } = useSyncWidget();

  const syncStatusStorage: string[] = []
  const syncStatusQueue: string[] = []

  if (storage.supported) syncStatusStorage.push(`${storage.percent}%`)
  if (syncing) syncStatusQueue.push("Syncing...")
  if (queueCount > 0) syncStatusQueue.push(`${queueCount}`)

  const syncStatusText = syncStatusStorage.length > 0 ? syncStatusStorage.join(" | ") : "Ready"
  const syncQueueStatusText = syncStatusQueue.length > 0 ? syncStatusQueue.join(" | ") : 'None'


  const syncStatusClass2= !online
    ? "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
    : storage.critical
      ? "flex items-center gap-1.5 text-[10px] font-bold text-amber-700 border-amber-300"
      : storage.nearLimit
        ? "flex items-center gap-1.5 text-[10px] font-bold text-yellow-700 border-yellow-300"
        : "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400";
    
    
  return (
    <>
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(setSidebarOpen(false))}
            className="fixed inset-0 bg-black z-40 lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>
     <motion.aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-[#12121a] text-slate-600 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-[#2a2a3e] transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-20'} ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}>
        {/* MIS SYSTEM */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#2a2a3e]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex items-center justify-center w-8 h-8 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
              <Activity className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <motion.div
              animate={{ opacity: sidebarOpen ? 1 : 0, display: sidebarOpen ? 'block' : 'none' }}
              className="whitespace-nowrap"
            >
              <h1 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white">MIS SYSTEM</h1>
              {/* <p className="text-[10px] text-slate-500 font-medium tracking-widest">V.1.0.0</p> */}
            </motion.div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#2a2a3e]">
          {groups.map((group, idx) => (
            <div key={idx} className="mb-2">
              {sidebarOpen && (
                <div className="px-6 mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">
                    {group.title}
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => isMobile && dispatch(setSidebarOpen(false))}
                      title={!sidebarOpen ? item.label : ''}
                      className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-200 group relative ${isActive ? 'bg-slate-100 dark:bg-[#1a1a2e] text-blue-600 dark:text-white border-r-2 border-blue-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1a1a2e]/50 border-r-2 border-transparent'}`}
                    >
                      <item.icon
                        size={18}
                        className={isActive ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}
                      />
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                      {isActive && sidebarOpen && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {sidebarOpen && (
          <div className="p-4 border-t border-slate-200 dark:border-[#2a2a3e] bg-slate-50 dark:bg-[#0f0f15]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">System Status</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3 h-3" /> SECURE
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Storage</span>
                <span className={`${syncStatusClass2}`}
                title={storage.supported ? `Storage used: ${storage.percent}%` : "Storage monitor unavailable"}
                > {syncStatusText}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Queue</span>
                <span className="text-slate-700 dark:text-white font-mono">{syncQueueStatusText}</span>
              </div>
              {/* <div className="w-full h-1 bg-slate-200 dark:bg-[#2a2a3e] rounded-full mt-2 overflow-hidden">
                <div className="h-full w-3/4 bg-blue-500 rounded-full animate-pulse" />
              </div> */}
            </div>
          </div>
        )}

        {!isMobile && (
          <div className="absolute top-1/2 -right-3 z-50">
            <button
              onClick={() => dispatch(setSidebarOpen(!sidebarOpen))}
              className="p-1 rounded-full bg-white dark:bg-[#2a2a3e] text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#12121a] shadow-lg"
              type="button"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </motion.aside>
    </>
  );
}
