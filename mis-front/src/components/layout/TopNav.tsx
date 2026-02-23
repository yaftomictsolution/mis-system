"use client";

import { useDispatch } from "react-redux";
import { logoutLocal } from "@/store/auth/authSlice";
import { useRouter } from "next/navigation";
import { useSyncWidget } from "@/sync/useSyncWidget";



import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserCircle,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../../app/context/ThemeContext'
import { toggleSidebar } from '../../store/uiSlice'
import CacheStatus from './CacheStatus';

type NotificationTone = 'success' | 'warning' | 'info'

type DashboardNotification = {
  id: number
  title: string
  description: string
  time: string
  tone: NotificationTone
  unread?: boolean
  icon: LucideIcon
}

const notifications: DashboardNotification[] = [
  {
    id: 1,
    title: 'Payment received',
    description: 'Installment for Apartment B2-12 was posted.',
    time: '2 min ago',
    tone: 'success',
    unread: true,
    icon: CheckCircle2,
  },
  {
    id: 2,
    title: 'Low inventory alert',
    description: 'Cement stock dropped below the minimum level.',
    time: '10 min ago',
    tone: 'warning',
    unread: true,
    icon: AlertTriangle,
  },
  {
    id: 3,
    title: 'Sales report ready',
    description: 'January performance report is available to download.',
    time: '35 min ago',
    tone: 'info',
    icon: FileText,
  },
]

const notificationToneStyles: Record<NotificationTone, { wrapper: string; icon: string }> = {
  success: {
    wrapper: 'bg-emerald-100 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    wrapper: 'bg-amber-100 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    wrapper: 'bg-blue-100 dark:bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
  },
}

export default function TopNav() {
  const router = useRouter();
  // const dispatch = useDispatch<AppDispatch>();
   ///////////
  const [time, setTime] = useState<string | null>(null)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const notificationMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = useTheme()
  const dispatch = useDispatch()
  // new add code
  const { online } = useSyncWidget();
  // end

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour12: false }))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isNotificationsOpen && !isProfileOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationsOpen(false)
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false)
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isNotificationsOpen, isProfileOpen])

  const unreadCount = notifications.filter((item) => item.unread).length

  const toggleNotifications = () => {
    setIsNotificationsOpen((isOpen) => {
      const nextState = !isOpen
      if (nextState) setIsProfileOpen(false)
      return nextState
    })
  }

  const toggleProfileMenu = () => {
    setIsProfileOpen((isOpen) => {
      const nextState = !isOpen
      if (nextState) setIsNotificationsOpen(false)
      return nextState
    })
  }





 return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-slate-200 dark:border-[#2a2a3e] bg-white/80 dark:bg-[#12121a]/50 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 hover:bg-slate-100 dark:hover:bg-[#1a1a2e] rounded-lg text-slate-500 dark:text-slate-400 lg:hidden transition-colors"
          type="button"
          aria-label="Toggle sidebar"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight hidden sm:block">
            Operations Command Center
          </h2>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-[#2a2a3e] hidden sm:block" />
           <span
            className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded border ${
              online
                ? "text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                : "text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  online ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  online ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </span>

            {online ? "ONLINE SYSTEM" : "OFFLINE SYSTEM"}
          </span>
        </div>
      </div>
  
      <div className="flex items-center gap-6">
        <div className="hidden xl:flex items-center gap-6 mr-4 border-r border-slate-200 dark:border-[#2a2a3e] pr-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Active</span>
            <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">2,492</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Proc. Rate</span>
            <span className="text-sm font-mono font-medium text-blue-600 dark:text-blue-400">142/min</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <div className="mr-3 hidden md:block">
            <CacheStatus />
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a2e] px-3 py-1.5 rounded border border-slate-200 dark:border-[#2a2a3e] min-w-[72px]">
            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
            {time ?? '--:--:--'}
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1a2e] border border-slate-200 dark:border-[#2a2a3e] text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
            type="button"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1a2e] rounded-lg">
            <Search className="w-4 h-4" />
          </button>

          <div ref={notificationMenuRef} className="relative">
            <button
              type="button"
              onClick={toggleNotifications}
              aria-expanded={isNotificationsOpen}
              aria-haspopup="menu"
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1a2e] rounded-lg"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[min(92vw,360px)] rounded-xl border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#12121a] shadow-xl dark:shadow-black/40 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#2a2a3e]">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
                    <p className="text-[10px] text-slate-500 mt-1">{unreadCount} unread updates</p>
                  </div>
                  <button
                    type="button"
                    className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto space-y-1.5">
                  {notifications.map((notification) => {
                    const Icon = notification.icon
                    const tone = notificationToneStyles[notification.tone]

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#1a1a2e] ${
                          notification.unread
                            ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5'
                            : 'border-transparent'
                        }`}
                      >
                        <span className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${tone.wrapper}`}>
                          <Icon className={`w-4 h-4 ${tone.icon}`} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 block">{notification.title}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">{notification.description}</span>
                        </span>
                        <span className="mt-0.5 text-[10px] text-slate-400 whitespace-nowrap">{notification.time}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-[#2a2a3e] mx-1 hidden sm:block" />

          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={toggleProfileMenu}
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
              className="flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-[#1a1a2e] p-1.5 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white border border-slate-200 dark:border-[#2a2a3e]">
                AR
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none">Ahmad Rahimi</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-none uppercase tracking-wide">Admin</p>
              </div>
              <ChevronDown size={14} className="text-slate-500 hidden sm:block" />
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[min(88vw,250px)] rounded-xl border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#12121a] shadow-xl dark:shadow-black/40 z-50 p-2">
                <div className="px-2 pt-2 pb-3 border-b border-slate-200 dark:border-[#2a2a3e]">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ahmad Rahimi</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">Administrator account</p>
                </div>

                <button
                  type="button"
                  className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a2e]"
                >
                  <UserCircle className="w-4 h-4 text-slate-500" />
                  My Profile
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a2e]"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  Account Settings
                </button>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#2a2a3e]">
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Session</p>
                  <button
                    type="button"
                    onClick={() => {
                        dispatch(logoutLocal());
                        router.replace("/login");
                      }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
  
  // return (
  //   <header className="h-14 border-b bg-white flex items-center justify-between px-4 sticky top-0 z-10">
  //     <div className="text-sm text-gray-600">
  //       Welcome, <b>{user?.full_name}</b>
  //     </div>

  //     <button
  //       className="text-sm px-3 py-1 rounded-lg border hover:bg-gray-100"
  //       onClick={() => {
  //         dispatch(logoutLocal());
  //         router.replace("/login");
  //       }}
  //     >
  //       Logout
  //     </button>
  //   </header>
  // );
}
