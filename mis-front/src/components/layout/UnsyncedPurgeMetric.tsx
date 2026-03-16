"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCachedOfflinePolicy,
  normalizeOfflinePolicy,
  type OfflinePolicy,
} from "@/modules/offline-policy/offline-policy.repo";

function formatPurgeValue(iso: string | null): string {
  if (!iso) return "Not set";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Invalid";
  return new Date(time).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPurgeHint(iso: string | null): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Invalid deadline configured";
  return time <= Date.now() ? "Deadline reached" : "Configured purge deadline";
}

export default function UnsyncedPurgeMetric() {
  const [policy, setPolicy] = useState<OfflinePolicy>(getCachedOfflinePolicy);

  useEffect(() => {
    const onPolicyChanged = (event: Event) => {
      const detail = (event as CustomEvent<OfflinePolicy>).detail;
      setPolicy(normalizeOfflinePolicy(detail));
    };

    window.addEventListener("offline-policy:changed", onPolicyChanged as EventListener);
    return () => {
      window.removeEventListener("offline-policy:changed", onPolicyChanged as EventListener);
    };
  }, []);

  const value = useMemo(() => formatPurgeValue(policy.unsynced_delete_at), [policy.unsynced_delete_at]);
  const hint = useMemo(() => formatPurgeHint(policy.unsynced_delete_at), [policy.unsynced_delete_at]);
  const isUnset = value === "Not set";

  return (
    <div className={`flex min-h-[34px] flex-col justify-center ${isUnset ? "items-center" : "items-end"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${isUnset ? "text-center" : ""}`}>
        Unsynced Purge
      </span>
      <span className={`text-sm font-mono font-medium text-amber-600 dark:text-amber-400 ${isUnset ? "text-center" : ""}`}>
        {value}
      </span>
      <span className={`mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 ${isUnset ? "text-center" : ""}`}>
        {hint}
      </span>
    </div>
  );
}
