"use client";

const DEVICE_ID_KEY = "mis_device_id_v1";

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDeviceId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";

  const current = normalizeDeviceId(window.localStorage.getItem(DEVICE_ID_KEY) ?? "");
  if (current) return current;

  const next = normalizeDeviceId(generateDeviceId()) || "web";
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export function buildDeviceName(): string {
  return `mis-front-web:${getOrCreateDeviceId()}`.slice(0, 120);
}
