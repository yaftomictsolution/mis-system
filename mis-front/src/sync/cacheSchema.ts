const CACHE_SCHEMA_KEY = "mis_cache_schema_version";
const CACHE_SCHEMA_VERSION = "2026-03-30-v4";

const CURSOR_KEYS = [
  "customers_sync_cursor",
  "apartments_sync_cursor",
  "apartment_sales_sync_cursor",
  "installments_sync_cursor",
  "roles_sync_cursor",
  "user_sync_cursor",
];

const CLEANUP_KEYS = [
  "customers_last_cleanup_ms",
  "apartments_last_cleanup_ms",
  "apartment_sales_last_cleanup_ms",
  "installments_last_cleanup_ms",
  "roles_last_cleanup_ms",
  "users_last_cleanup_ms",
];

let ensured = false;

async function clearApiCacheBucket(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("caches" in window)) return;

  try {
    await caches.delete("api-get");
  } catch {
    // ignore cache deletion failures, cursor reset is the critical part
  }
}

async function clearAllCacheBuckets(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("caches" in window)) return;

  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // ignore cache deletion failures, local key reset remains the critical fallback
  }
}

export async function ensureCacheSchemaCompatibility(): Promise<void> {
  if (ensured || typeof window === "undefined") return;
  ensured = true;

  const current = window.localStorage.getItem(CACHE_SCHEMA_KEY);
  if (current === CACHE_SCHEMA_VERSION) return;

  for (const key of [...CURSOR_KEYS, ...CLEANUP_KEYS]) {
    window.localStorage.removeItem(key);
  }

  await clearApiCacheBucket();
  await clearAllCacheBuckets();
  window.localStorage.setItem(CACHE_SCHEMA_KEY, CACHE_SCHEMA_VERSION);
}
