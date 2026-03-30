"use client";

import { db } from "@/db/localDB";
import type { CacheRoute } from "@/config/cacheRoutes";
import { hasAnyPermission } from "@/lib/permissions";

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path !== "/" && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

async function waitForServiceWorkerReady(timeoutMs = 8000): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  await navigator.serviceWorker.ready.catch(() => undefined);
  if (navigator.serviceWorker.controller) return;

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, timeoutMs);
    const onControllerChange = () => {
      window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  });
}

export async function listDynamicCacheRoutes(permissions: string[] = []): Promise<CacheRoute[]> {
  const routeMap = new Map<string, string>();

  if (hasAnyPermission(permissions, "customers.view")) {
    const customers = await db.customers.toArray();
    for (const customer of customers) {
      const uuid = String(customer.uuid ?? "").trim();
      if (!uuid) continue;
      routeMap.set(`/customers/${uuid}`, `${customer.name || "Customer"} Detail`);
      routeMap.set(`/customers/${uuid}/activity`, `${customer.name || "Customer"} Activity`);
    }
  }

  if (hasAnyPermission(permissions, "sales.create")) {
    const sales = await db.apartment_sales.toArray();
    for (const sale of sales) {
      const uuid = String(sale.uuid ?? "").trim();
      const saleId = String(sale.sale_id ?? "").trim() || uuid.slice(0, 8).toUpperCase();
      if (!uuid) continue;
      routeMap.set(`/print/apartment-sales/${uuid}/sale`, `${saleId} Summary`);
      routeMap.set(`/apartment-sales/${uuid}/financial`, `${saleId} Financial`);
      routeMap.set(`/apartment-sales/${uuid}/history`, `${saleId} History`);
    }
  }

  if (hasAnyPermission(permissions, "payroll.view")) {
    const salaryPayments = await db.salary_payments.toArray();
    for (const payment of salaryPayments) {
      const uuid = String(payment.uuid ?? "").trim();
      if (!uuid) continue;
      const slipId = `PS-${uuid.slice(0, 8).toUpperCase()}`;
      routeMap.set(`/print/payroll/${uuid}/payslip`, `${slipId} Payslip`);
    }
  }

  if (hasAnyPermission(permissions, ["material_requests.view", "inventory.request"])) {
    const materialRequests = await db.material_requests.toArray();
    for (const request of materialRequests) {
      const uuid = String(request.uuid ?? "").trim();
      if (!uuid) continue;
      const requestId = String(request.issue_receipt_no ?? request.request_no ?? "").trim() || `MR-${uuid.slice(0, 8).toUpperCase()}`;
      routeMap.set(`/print/material-requests/${uuid}/receipt`, `${requestId} Material Record`);
    }
  }

  return Array.from(routeMap.entries()).map(([path, label]) => ({
    path: normalizePath(path),
    label,
  }));
}

async function postRouteToServiceWorker(path: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  await waitForServiceWorkerReady();

  const normalized = normalizePath(path);
  const routeAbs = new URL(normalized, window.location.origin).href;
  const reg = await navigator.serviceWorker.ready;
  const target = navigator.serviceWorker.controller || reg.active || reg.waiting;
  if (!target) return;

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = window.setTimeout(resolve, 2000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    target.postMessage({ type: "CACHE_URLS", payload: { urlsToCache: [normalized, routeAbs] } }, [channel.port2]);
  });
}

export async function warmRouteForOffline(path: string, prefetch?: (href: string) => void): Promise<void> {
  if (typeof window === "undefined") return;
  await waitForServiceWorkerReady();

  const normalized = normalizePath(path);
  const routeAbs = new URL(normalized, window.location.origin).href;

  try {
    prefetch?.(normalized);
  } catch {
    // Router prefetch is optional. The SW/document warmers below are still the source of truth.
  }

  await postRouteToServiceWorker(normalized).catch(() => {});
  await fetch(routeAbs, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "text/html", "x-mis-cache-warm": "1" },
  }).catch(() => {});
}
