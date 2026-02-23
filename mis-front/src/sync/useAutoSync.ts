"use client";

import { useEffect } from "react";
import { runSyncOnce } from "./syncEngine";

const SYNC_POLL_MS = 10000;

export function useAutoSync() {
  useEffect(() => {
    const triggerSync = () => {
      void runSyncOnce();
    };

    const onOnline = () => {
      console.log("Back online -> syncing...");
      triggerSync();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("sync:queue:changed", triggerSync as EventListener);
    document.addEventListener("visibilitychange", onVisible);

    // Try once on mount.
    triggerSync();

    // Safety net: if online event is missed, this keeps queue moving.
    const interval = window.setInterval(triggerSync, SYNC_POLL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("sync:queue:changed", triggerSync as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);
}

