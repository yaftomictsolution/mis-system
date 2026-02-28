"use client";
import { useSyncWidget } from "@/sync/useSyncWidget";
import { formatBytes } from "@/storage/storageMonitor";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function SystemStatus(){
 const { online, queueCount, syncing, storage, refreshStorage } = useSyncWidget();
 const [refreshing, setRefreshing] = useState(false);


  const queueParts: string[] = [];

  if (syncing) queueParts.push("Syncing...");
  if (queueCount > 0) queueParts.push(`${queueCount}`);

  const rawPercent = storage.quota > 0 ? (storage.usage / storage.quota) * 100 : 0;
  const usedText = storage.supported ? formatBytes(storage.usage) : "-";
  const totalText = storage.supported ? formatBytes(storage.quota) : "-";
  const freeText = storage.supported ? formatBytes(Math.max(0, storage.quota - storage.usage)) : "-";
  const syncStatusText = storage.supported ? `${rawPercent.toFixed(6)}%` : "Ready";
  const syncQueueStatusText = queueParts.length ? queueParts.join(" | ") : "None";
  const syncStatusClass = !online
    ? "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
    : storage.critical
      ? "flex items-center gap-1.5 text-[10px] font-bold text-amber-700 border-amber-300"
      : storage.nearLimit
        ? "flex items-center gap-1.5 text-[10px] font-bold text-yellow-700 border-yellow-300"
        : "flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400";


    return (
        <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-[#2a2a3e] dark:bg-[#0f0f15]">
            {/* <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">System Status</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> SECURE
              </span>
            </div> */}
           
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                 <button
                type="button"
                disabled={refreshing}
                onClick={() => {
                  void (async () => {
                    setRefreshing(true);
                    try {
                      await refreshStorage({ aggressive: true });
                    } finally {
                      setRefreshing(false);
                    }
                  })();
                }}
                className="rounded  text-[10px] font-semibold  text-slate-500 dark:text-slate-400 "
              >
                {refreshing ? "Refreshing..." : "Storage"}
              </button>

                {/* <span className="text-slate-500 dark:text-slate-400">Storage</span> */}
                <span
                  className={syncStatusClass}
                  title={
                    storage.supported
                      ? `Storage used: ${rawPercent.toFixed(6)}% (${usedText} / ${totalText})`
                      : "Storage monitor unavailable"
                  }>
                  {syncStatusText}
                </span>
              </div>
              {storage.estimatedFromIndexedDb && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {/* (estimated from IndexedDB) */}
                   
                </div>
              )}
              {/* <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Used</span>
                <span className="font-mono text-slate-700 dark:text-white">{usedText}</span>
              </div> */}
              {/* <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Free</span>
                <span className="font-mono text-slate-700 dark:text-white">{freeText}</span>
              </div> */}
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="font-mono text-slate-700 dark:text-white">{totalText}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Queue</span>
                <span className="font-mono text-slate-700 dark:text-white">{syncQueueStatusText}</span>
              </div>
            </div>
          </div>
    )
}
