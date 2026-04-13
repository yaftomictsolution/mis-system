"use client";

import { useEffect, useRef } from "react";
import { runSyncOnce } from "./syncEngine";

const SYNC_POLL_MS = 15000;
const VISIBLE_SYNC_COOLDOWN_MS = 30000;

export function useAutoSync() {
  const lastVisibleSyncAtRef = useRef(0);

  useEffect(() => {
    const triggerSync = (reason: "mount" | "online" | "queue" | "visible" | "poll") => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      if (reason === "visible" || reason === "poll") {
        const now = Date.now();
        if (now - lastVisibleSyncAtRef.current < VISIBLE_SYNC_COOLDOWN_MS) {
          return;
        }
        lastVisibleSyncAtRef.current = now;
      }

      void runSyncOnce();
    };

    const onOnline = () => {
      console.log("Back online -> syncing...");
      triggerSync("online");
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        triggerSync("visible");
      }
    };

    const onQueueChanged = () => {
      triggerSync("queue");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("sync:queue:changed", onQueueChanged as EventListener);
    document.addEventListener("visibilitychange", onVisible);

    // Try once on mount.
    triggerSync("mount");

    // Safety net: if online event is missed, this keeps queue moving.
    const interval = window.setInterval(() => {
      triggerSync("poll");
    }, SYNC_POLL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("sync:queue:changed", onQueueChanged as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);
}

