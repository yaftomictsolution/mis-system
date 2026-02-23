"use client";

import { useEffect, useState } from "react";
import { getQueueCount } from "./queueCount";
import { getSyncing, subscribeSyncing } from "./syncStatus";
import { getStorageStats, requestPersistentStorage, type StorageStats } from "@/storage/storageMonitor";

const EMPTY_STORAGE: StorageStats = {
  supported: false,
  persisted: null,
  usage: 0,
  quota: 0,
  percent: 0,
  nearLimit: false,
  critical: false,
};

export function useSyncWidget() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncingState] = useState(getSyncing());
  const [storage, setStorage] = useState<StorageStats>(EMPTY_STORAGE);

  async function refreshQueue() {
    const count = await getQueueCount();
    setQueueCount(count);
  }

  async function refreshStorage() {
    const stats = await getStorageStats();
    setStorage(stats);
  }

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void refreshQueue();
      void refreshStorage();
      void requestPersistentStorage();
    }, 0);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onSyncComplete = () => {
      refreshQueue();
      refreshStorage();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("sync:complete", onSyncComplete as EventListener);

    const unsub = subscribeSyncing((value) => setSyncingState(value));
    const queueInterval = window.setInterval(refreshQueue, 1500);
    const storageInterval = window.setInterval(refreshStorage, 30000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      unsub();
      window.clearTimeout(initTimer);
      window.clearInterval(queueInterval);
      window.clearInterval(storageInterval);
    };
  }, []);

  return { online, queueCount, syncing, refreshQueue, storage, refreshStorage };
}
