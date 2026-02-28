"use client";

export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  id?: string;
  type: ToastType;
  message: string;
  duration_ms?: number;
};

export const TOAST_EVENT_NAME = "app:toast";

function dispatchToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}

export function notify(type: ToastType, message: string, duration_ms?: number) {
  dispatchToast({
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
    type,
    message,
    duration_ms,
  });
}

export function notifySuccess(message: string, duration_ms?: number) {
  notify("success", message, duration_ms);
}

export function notifyError(message: string, duration_ms?: number) {
  notify("error", message, duration_ms);
}

export function notifyInfo(message: string, duration_ms?: number) {
  notify("info", message, duration_ms);
}

