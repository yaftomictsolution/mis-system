"use client";

import { Activity } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { setSidebarOpen } from "../../store/uiSlice";
import SystemStatus from "../layout/SystemStatus";
import SidebarChevron from "../layout/SidbarChevron"
import SideContent from "../layout/SideContent"; 


export default function Sidebar() {
  const dispatch = useDispatch();
  const { sidebarOpen, isMobile } = useSelector((state: RootState) => state.ui);

  return (
    <>
      {/* close open sidebar in mobile mode */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(setSidebarOpen(false))}
            className="fixed inset-0 z-40 bg-black lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white text-slate-600 transition-all duration-300 ease-in-out dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300 ${sidebarOpen ? "w-64" : "w-20"} ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#2a2a3e]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Activity className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </div>
            <motion.div animate={{ opacity: sidebarOpen ? 1 : 0, display: sidebarOpen ? "block" : "none" }} className="whitespace-nowrap">
              <h1 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white">MIS SYSTEM</h1>
            </motion.div>
          </div>
        </div>

        <SideContent />

        {sidebarOpen && (
         <SystemStatus />
        )}
        {!isMobile && (
         <SidebarChevron />
        )}
      </motion.aside>
    </>
  );
}
