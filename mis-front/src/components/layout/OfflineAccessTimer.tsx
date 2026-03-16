"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCachedOfflinePolicy,
  normalizeOfflinePolicy,
  offlinePolicyGet,
  type OfflinePolicy,
} from "@/modules/offline-policy/offline-policy.repo";

function formatCountdown(iso: string | null, now: number): string {
  if (!iso) return "Not set";

  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "Not set";

  const diffMs = target - now;
  if (diffMs <= 0) return "Expired";

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatTarget(iso: string | null): string {
  if (!iso) return "Offline access deadline is not set";
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "Offline access deadline is invalid";
  return new Date(target).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  className?: string;
};

export default function OfflineAccessTimer({ className = "" }: Props) {
  const [policy, setPolicy] = useState<OfflinePolicy>(getCachedOfflinePolicy);
  const [now, setNow] = useState(() => Date.now());

  const refreshPolicy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    try {
      const next = await offlinePolicyGet();
      setPolicy(next);
    } catch {
      setPolicy(getCachedOfflinePolicy());
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    const timer = window.setTimeout(() => {
      void refreshPolicy();
    }, 0);
    return () => window.clearTimeout(timer);
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

  const countdown = useMemo(() => formatCountdown(policy.system_offline_until, now), [now, policy.system_offline_until]);
  const tooltip = useMemo(() => formatTarget(policy.system_offline_until), [policy.system_offline_until]);
  const expired = countdown === "Expired";
  const isUnset = countdown === "Not set";

  return (
    <div
      className={`${className} flex min-h-[34px] flex-col justify-center ${isUnset ? "items-center" : "items-end"}`}
      title={tooltip}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Offline Access
      </span>
      <span
        className={`text-sm font-mono font-medium tabular-nums text-center ${
          expired ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
        }`}
        >
        <span>{countdown}</span>
      </span>
    </div>
  );
}
