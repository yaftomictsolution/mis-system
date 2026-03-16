"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock3, ShieldAlert, Trash2 } from "lucide-react";
import {
  getCachedOfflinePolicy,
  normalizeOfflinePolicy,
  offlinePolicyGet,
  type OfflinePolicy,
} from "@/modules/offline-policy/offline-policy.repo";

type CountdownState = {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "warning" | "danger";
};

type Props = {
  variant?: "topbar" | "panel";
};

function formatTargetDate(iso: string | null): string {
  if (!iso) return "No limit set";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Invalid date";
  return new Date(time).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(iso: string | null, now: number, label: string): CountdownState {
  if (!iso) {
    return {
      label,
      value: "Not set",
      hint: "No deadline configured",
      tone: "neutral",
    };
  }

  const target = Date.parse(iso);
  if (!Number.isFinite(target)) {
    return {
      label,
      value: "Invalid",
      hint: "Stored date is invalid",
      tone: "danger",
    };
  }

  const diffMs = target - now;
  if (diffMs <= 0) {
    return {
      label,
      value: "Expired",
      hint: formatTargetDate(iso),
      tone: "danger",
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    `${String(hours).padStart(2, "0")}h`,
    `${String(minutes).padStart(2, "0")}m`,
    `${String(seconds).padStart(2, "0")}s`,
  ].filter(Boolean);

  return {
    label,
    value: parts.join(" "),
    hint: formatTargetDate(iso),
    tone: diffMs <= 24 * 60 * 60 * 1000 ? "warning" : "neutral",
  };
}

function toneClasses(tone: CountdownState["tone"]): string {
  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#2a2a3e] dark:bg-[#171723] dark:text-slate-200";
}

function CountdownCard({ icon, state }: { icon: ReactNode; state: CountdownState }) {
  return (
    <div className={`min-w-[180px] rounded-xl border px-3 py-2 ${toneClasses(state.tone)}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 opacity-80">{icon}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{state.label}</div>
          <div className="mt-1 text-sm font-semibold tabular-nums">{state.value}</div>
          <div className="mt-1 truncate text-[10px] opacity-70">{state.hint}</div>
        </div>
      </div>
    </div>
  );
}

export default function OfflinePolicyCountdowns({ variant = "topbar" }: Props) {
  const [policy, setPolicy] = useState<OfflinePolicy>(getCachedOfflinePolicy);
  const [now, setNow] = useState(() => Date.now());

  const refreshPolicy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) {
      setPolicy(getCachedOfflinePolicy());
      return;
    }

    try {
      const next = await offlinePolicyGet();
      setPolicy(next);
    } catch {
      setPolicy(getCachedOfflinePolicy());
    }
  }, []);

  useEffect(() => {
    void refreshPolicy();
  }, [refreshPolicy]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onPolicyChanged = (event: Event) => {
      const detail = (event as CustomEvent<OfflinePolicy>).detail;
      setPolicy(normalizeOfflinePolicy(detail));
    };
    const onOnline = () => {
      void refreshPolicy();
    };

    window.addEventListener("offline-policy:changed", onPolicyChanged as EventListener);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline-policy:changed", onPolicyChanged as EventListener);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshPolicy]);

  const offlineAccess = useMemo(
    () => formatCountdown(policy.system_offline_until, now, "Offline Access"),
    [now, policy.system_offline_until]
  );
  const unsyncedPurge = useMemo(
    () => formatCountdown(policy.unsynced_delete_at, now, "Unsynced Purge"),
    [now, policy.unsynced_delete_at]
  );

  if (variant === "panel") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Offline Deadlines</p>
          <p className="text-xs text-slate-500">
            Live countdown for offline access expiry, unsynced purge, and current unsynced retention.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CountdownCard icon={<Clock3 className="h-4 w-4" />} state={offlineAccess} />
          <CountdownCard icon={<Trash2 className="h-4 w-4" />} state={unsyncedPurge} />
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 opacity-80" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Unsynced Retention</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{policy.unsynced_retention_days} days</div>
                <div className="mt-1 text-[10px] opacity-70">Offline queue cleanup window</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden xl:flex items-center gap-3 mr-4 border-r border-slate-200 pr-6 dark:border-[#2a2a3e]">
      <CountdownCard icon={<Clock3 className="h-4 w-4" />} state={offlineAccess} />
      <CountdownCard icon={<Trash2 className="h-4 w-4" />} state={unsyncedPurge} />
      <div className="hidden 2xl:flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Unsynced Retention</div>
          <div className="mt-1 text-sm font-semibold tabular-nums">{policy.unsynced_retention_days} days</div>
        </div>
      </div>
    </div>
  );
}
