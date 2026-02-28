"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { TOAST_EVENT_NAME, type ToastPayload } from "@/lib/notify";

type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  durationMs: number;
};

const DEFAULT_DURATION_MS = 3200;
const ERROR_DURATION_MS = 4500;

function getDuration(payload: ToastPayload): number {
  if (typeof payload.duration_ms === "number" && payload.duration_ms > 0) {
    return payload.duration_ms;
  }
  return payload.type === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS;
}

function getStyles(type: ToastItem["type"]) {
  if (type === "success") {
    return {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    };
  }

  if (type === "error") {
    return {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      box: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
    };
  }

  return {
    icon: <Info className="h-5 w-5 text-blue-500" />,
    box: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
  };
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;

    const onToast = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      const detail = custom.detail;
      if (!detail || !detail.message) return;

      const id = detail.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
      const item: ToastItem = {
        id,
        type: detail.type,
        message: detail.message,
        durationMs: getDuration(detail),
      };

      setToasts((prev) => [...prev, item].slice(-5));

      const timerId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        timersRef.current.delete(id);
      }, item.durationMs);

      timers.set(id, timerId);
    };

    window.addEventListener(TOAST_EVENT_NAME, onToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast as EventListener);
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const dismiss = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const styles = getStyles(toast.type);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-3 shadow-lg ${styles.box}`}
          >
            <div className="mt-0.5">{styles.icon}</div>
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
