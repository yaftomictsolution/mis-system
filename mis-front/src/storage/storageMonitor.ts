export type StorageStats = {
  supported: boolean;
  persisted: boolean | null;
  usage: number;
  quota: number;
  percent: number;
  nearLimit: boolean;
  critical: boolean;
};

const EMPTY_STORAGE_STATS: StorageStats = {
  supported: false,
  persisted: null,
  usage: 0,
  quota: 0,
  percent: 0,
  nearLimit: false,
  critical: false,
};

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
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

