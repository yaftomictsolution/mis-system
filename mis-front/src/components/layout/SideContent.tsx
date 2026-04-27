"use client";
import { NAV_ITEMS } from "@/config/nav";
import {
  hasAccess,
  shouldHideForRole,
  type PermissionRequirement,
  type RoleRequirement,
} from "@/lib/permissions";
import { RootState } from "@/store/store";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { setSidebarOpen } from "@/store/uiSlice";
import { fetchMe } from "@/store/auth/authSlice";
import type { AppDispatch } from "@/store/store";

const DROPDOWN_GROUP_TITLE = "User & Rolses";

const GROUP_TITLE_CLASS = "text-sm  tracking-[0.14em] text-slate-500 dark:text-slate-400 font-bold";
const NAV_ITEM_BASE_CLASS =
  "w-full flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-200 group relative border-r-2";
const NAV_ITEM_ACTIVE_CLASS = "bg-slate-100 dark:bg-[#1a1a2e] text-blue-600 dark:text-white border-blue-500";
const NAV_ITEM_IDLE_CLASS =
  "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1a1a2e]/50 border-transparent";

function navItemClass(isActive: boolean): string {
  return `${NAV_ITEM_BASE_CLASS} ${isActive ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_IDLE_CLASS}`;
}

function navIconClass(isActive: boolean): string {
  return isActive
    ? "text-blue-500 dark:text-blue-400"
    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300";
}

export default function SideContent(){

  const pathname = usePathname();
  const perms: string[] = useSelector((s: RootState) => s.auth.user?.permissions || []);
  const roles: string[] = useSelector((s: RootState) => s.auth.user?.roles || []);
  const { sidebarOpen, isMobile } = useSelector((state: RootState) => state.ui);
  const [isUserRolesOpen, setIsUserRolesOpen] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    void dispatch(fetchMe());
  }, [dispatch]);

  const groups = NAV_ITEMS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
      const permission: PermissionRequirement | undefined =
        "permission" in item ? (item.permission as PermissionRequirement | undefined) : undefined;
      const role: RoleRequirement | undefined =
        "role" in item ? (item.role as RoleRequirement | undefined) : undefined;
      const hideForRole: RoleRequirement | undefined =
        "hideForRole" in item ? (item.hideForRole as RoleRequirement | undefined) : undefined;
      if (shouldHideForRole(roles, hideForRole, perms)) {
        return false;
      }
      return hasAccess(perms, roles, permission, role);
      }),
  })).filter((group) => group.items.length > 0);

    return(
         <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#2a2a3e]">
          {groups.map((group) => {
            const isDropdownGroup = group.title === DROPDOWN_GROUP_TITLE;
            const isGroupOpen = !sidebarOpen || !isDropdownGroup || isUserRolesOpen;

            return (
              <div key={group.title} className="mb-8">
                {sidebarOpen &&
                  (isDropdownGroup ? (
                    <button
                      type="button"
                      onClick={() => setIsUserRolesOpen((prev) => !prev)}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-5 py-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1a2e]"
                    >
                      <p className={GROUP_TITLE_CLASS}>{group.title}</p>
                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform duration-200 ${isUserRolesOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                    <div className="mb-2 px-6">
                      <p className={GROUP_TITLE_CLASS}>{group.title}</p>
                    </div>
                  ))}

                <AnimatePresence initial={false}>
                  {isGroupOpen && (
                    <motion.div
                      initial={sidebarOpen ? { height: 0, opacity: 0 } : false}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={sidebarOpen ? { height: 0, opacity: 0 } : undefined}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="space-y-0.5 overflow-hidden"
                    >
                      {group.items.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            prefetch={false}
                            onClick={() => {
                              if (isMobile) dispatch(setSidebarOpen(false));
                            }}
                            title={!sidebarOpen ? item.label : ""}
                            className={navItemClass(isActive)}
                          >
                            <item.icon size={18} className={navIconClass(isActive)} />
                            {sidebarOpen && <span className="truncate">{item.label}</span>}
                            {isActive && sidebarOpen && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
    )

}
