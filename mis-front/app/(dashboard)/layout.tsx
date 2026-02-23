"use client";
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setMobile } from '../../src/store/uiSlice'
import AuthGate from "@/components/auth/AuthGate";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { useAutoSync } from "@/sync/useAutoSync";
import { usePrecacheRoutes } from "@/pwa/usePrecacheRoutes";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch()
  useAutoSync();
  usePrecacheRoutes();

   useEffect(() => {
    const handleResize = () => {
      dispatch(setMobile(window.innerWidth < 1024))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dispatch])

  return (
    <AuthGate>
      <div className="flex h-screen w-full bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30 transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <TopNav />
          <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#2a2a3e] scrollbar-track-transparent">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
