export type StorageStats = {
  supported: boolean;
  persisted: boolean | null;
  usage: number;
  quota: number;
  percent: number;
  nearLimit: boolean;
  critical: boolean;
  estimatedFromIndexedDb: boolean;
};

const EMPTY_STORAGE_STATS: StorageStats = {
  supported: false,
  persisted: null,
  usage: 0,
  quota: 0,
  percent: 0,
  nearLimit: false,
  critical: false,
  estimatedFromIndexedDb: false,
};

function estimateValueBytes(value: unknown, seen = new WeakSet<object>()): number {
  if (value === null || value === undefined) return 0;

  const t = typeof value;
  if (t === "string") return (value as string).length * 2;
  if (t === "number") return 8;
  if (t === "boolean") return 4;
  if (t === "bigint") return 8;

  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateValueBytes(item, seen), 0);
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return 0;
    seen.add(obj);

    let bytes = 0;
    for (const [k, v] of Object.entries(obj)) {
      bytes += k.length * 2;
      bytes += estimateValueBytes(v, seen);
    }
    return bytes;
  }

  return 0;
}

async function getIndexedDbApproxUsage(dbName: string): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(() => null);

  if (!db) return 0;

  let total = 0;
  const stores = Array.from(db.objectStoreNames);

  for (const storeName of stores) {
    // Read each record through cursor to avoid loading full tables into memory at once.
    const storeBytes = await new Promise<number>((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      let sum = 0;

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        sum += estimateValueBytes(cursor.value);
        cursor.continue();
      };

      tx.oncomplete = () => resolve(sum);
      tx.onerror = () => resolve(sum);
      tx.onabort = () => resolve(sum);
    });

    total += storeBytes;
  }

  db.close();
  return total;
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10000) / 10000));
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return null;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function getStorageStats(): Promise<StorageStats> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return EMPTY_STORAGE_STATS;
  }

  try {
    const estimate = await navigator.storage.estimate();
    let usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    let estimatedFromIndexedDb = false;

    if (usage === 0) {
      const fallback = await getIndexedDbApproxUsage("mis_local_db");
      if (fallback > 0) {
        usage = fallback;
        estimatedFromIndexedDb = true;
      }
    }

    const percent = quota > 0 ? roundPercent((usage / quota) * 100) : 0;

    let persisted: boolean | null = null;
    if (navigator.storage?.persisted) {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        persisted = null;
      }
    }

    return {
      supported: true,
      persisted,
      usage,
      quota,
      percent,
      nearLimit: percent >= 80,
      critical: percent >= 90,
      estimatedFromIndexedDb,
    };
  } catch {
    return EMPTY_STORAGE_STATS;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const decimals = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

