"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
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
} from "lucide-react";
import { logoutLocal } from "@/store/auth/authSlice";
import type { RootState } from "@/store/store";
import { notifyInfo } from "@/lib/notify";
import { toggleSidebar } from "@/store/uiSlice";
import { useTheme } from "../../../app/context/ThemeContext";
import CacheStatus from "./CacheStatus";
import OfflineAccessTimer from "./OfflineAccessTimer";
import UnsyncedPurgeMetric from "./UnsyncedPurgeMetric";
import { useSyncWidget } from "@/sync/useSyncWidget";
import {
  notificationMarkAllRead,
  notificationMarkRead,
  notificationsListMine,
  type AdminNotificationRow,
} from "@/modules/notifications/notifications.repo";
import { subscribeAppEvent } from "@/lib/appEvents";

type NotificationTone = "success" | "warning" | "info";

type DashboardNotification = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: NotificationTone;
  unread: boolean;
  icon: LucideIcon;
  category: string;
  saleUuid?: string;
};

const notificationToneStyles: Record<NotificationTone, { wrapper: string; icon: string }> = {
  success: {
    wrapper: "bg-emerald-100 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    wrapper: "bg-amber-100 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
  },
  info: {
    wrapper: "bg-blue-100 dark:bg-blue-500/10",
    icon: "text-blue-600 dark:text-blue-400",
  },
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0].slice(0, 1) + words[1].slice(0, 1)).toUpperCase();
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hr ago`;
  return `${Math.floor(diffSeconds / 86400)} day ago`;
}

function mapApiNotification(item: AdminNotificationRow): DashboardNotification {
  const category = String(item.category ?? "").trim().toLowerCase();
  const unread = !item.read_at;

  let tone: NotificationTone = unread ? "warning" : "info";
  let icon: LucideIcon = FileText;

  if (category === "sale_deed_eligible") {
    tone = unread ? "warning" : "success";
    icon = AlertTriangle;
  }

  return {
    id: item.id,
    title: item.title || "Notification",
    description: item.message || "",
    time: formatRelativeTime(item.created_at),
    tone,
    unread,
    icon,
    category,
    saleUuid: item.sale_uuid ?? undefined,
  };
}

export default function TopNav() {
  
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const { theme, toggleTheme } = useTheme();
  const { online } = useSyncWidget();

  const [time, setTime] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const canApproveSales = Boolean(user?.permissions?.includes("sales.approve"));
  const displayName = user?.full_name?.trim() || "User";
  const firstRole = Array.isArray(user?.roles) ? String(user?.roles[0] ?? "").trim() : "";
  const displayRole = firstRole || (canApproveSales ? "Admin" : "User");
  const initials = getInitials(displayName);

  const unreadCount = useMemo(() => notifications.filter((item) => item.unread).length, [notifications]);
  const unreadEligibleCount = useMemo(
    () => notifications.filter((item) => item.unread && item.category === "sale_deed_eligible").length,
    [notifications]
  );

  const loadNotifications = useCallback(
    async (showAdminToast: boolean) => {
      if (!user) return;

      setNotificationsLoading(true);
      try {
        const page = await notificationsListMine({ page: 1, perPage: 20 });
        const mapped = page.items.map(mapApiNotification);
        setNotifications(mapped);

        if (showAdminToast && canApproveSales) {
          const deedCount = mapped.filter((item) => item.unread && item.category === "sale_deed_eligible").length;
          if (deedCount > 0) {
            const key = `deed-alert-${user.id}-${new Date().toDateString()}`;
            if (!sessionStorage.getItem(key)) {
              notifyInfo(`${deedCount} sale(s) are ready for deed approval.`);
              sessionStorage.setItem(key, "1");
            }
          }
        }
      } catch {
        // Keep silent in top bar.
      } finally {
        setNotificationsLoading(false);
      }
    },
    [canApproveSales, user]
  );

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour12: false }));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadNotifications(true);
  }, [loadNotifications, user]);

  useEffect(() => {
    if (!user) return;

    const onSyncComplete = () => {
      void loadNotifications(false);
    };
    const unsubscribeNotifications = subscribeAppEvent("notifications:changed", () => {
      void loadNotifications(false);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeNotifications();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadNotifications, user]);

  useEffect(() => {
    if (!isNotificationsOpen && !isProfileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationsOpen, isProfileOpen]);

  const toggleNotifications = () => {
    setIsNotificationsOpen((isOpen) => {
      const nextState = !isOpen;
      if (nextState) {
        setIsProfileOpen(false);
        void loadNotifications(false);
      }
      return nextState;
    });
  };

  const toggleProfileMenu = () => {
    setIsProfileOpen((isOpen) => {
      const nextState = !isOpen;
      if (nextState) setIsNotificationsOpen(false);
      return nextState;
    });
  };

  const handleNotificationClick = async (item: DashboardNotification) => {
    try {
      if (item.unread) {
        await notificationMarkRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, unread: false, tone: "success" } : n))
        );
      }
    } catch {
      // No-op
    }

    setIsNotificationsOpen(false);
    if (item.saleUuid) {
      router.push(`/apartment-sales/${item.saleUuid}/financial`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationMarkAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, unread: false, tone: "success" })));
    } catch {
      // No-op
    }
  };

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
          <div className="flex flex-col items-start gap-1">
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
      </div>

      <div className="flex items-center gap-6">
        
        {/* <div className="hidden xl:flex items-center gap-6 mr-4 border-r border-slate-200 dark:border-[#2a2a3e] pr-6">
          {!online ? <OfflineAccessTimer className="hidden lg:flex self-start" />: null}
          {!online ? <UnsyncedPurgeMetric />: null}
        </div> */}

        <div className="hidden md:flex items-center gap-2">
          <div className="mr-3 hidden md:block">
            <CacheStatus />
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1a1a2e] px-3 py-1.5 rounded border border-slate-200 dark:border-[#2a2a3e] min-w-[72px]">
            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
            {time ?? "--:--:--"}
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1a2e] border border-slate-200 dark:border-[#2a2a3e] text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
            type="button"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1a2e] rounded-lg"
          >
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
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[min(92vw,360px)] rounded-xl border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#12121a] shadow-xl dark:shadow-black/40 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#2a2a3e]">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {unreadCount} unread updates
                      {canApproveSales && unreadEligibleCount > 0 ? ` | ${unreadEligibleCount} deed approvals` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleMarkAllRead();
                    }}
                    className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto space-y-1.5">
                  {notificationsLoading && (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Loading notifications...</div>
                  )}
                  {!notificationsLoading && notifications.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No notifications yet.</div>
                  )}
                  {notifications.map((notification) => {
                    const Icon = notification.icon;
                    const tone = notificationToneStyles[notification.tone];

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          void handleNotificationClick(notification);
                        }}
                        className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#1a1a2e] ${
                          notification.unread
                            ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5"
                            : "border-transparent"
                        }`}
                      >
                        <span className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${tone.wrapper}`}>
                          <Icon className={`w-4 h-4 ${tone.icon}`} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 block">
                            {notification.title}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                            {notification.description}
                          </span>
                        </span>
                        <span className="mt-0.5 text-[10px] text-slate-400 whitespace-nowrap">{notification.time}</span>
                      </button>
                    );
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white border border-slate-200 dark:border-[#2a2a3e]">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none">{displayName}</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-none uppercase tracking-wide">{displayRole}</p>
              </div>
              <ChevronDown size={14} className="text-slate-500 hidden sm:block" />
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[min(88vw,250px)] rounded-xl border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#12121a] shadow-xl dark:shadow-black/40 z-50 p-2">
                <div className="px-2 pt-2 pb-3 border-b border-slate-200 dark:border-[#2a2a3e]">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{displayName}</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{displayRole} account</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    router.push("/profile");
                  }}
                  className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a2e]"
                >
                  <UserCircle className="w-4 h-4 text-slate-500" />
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    router.push("/account-settings");
                  }}
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
  );
}
