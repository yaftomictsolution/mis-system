let syncing = false;
const listeners = new Set<(v: boolean) => void>();

export function setSyncing(v: boolean) {
  syncing = v;
  listeners.forEach((fn) => fn(v));
}

export function getSyncing() {
  return syncing;
}

export function subscribeSyncing(fn: (v: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
