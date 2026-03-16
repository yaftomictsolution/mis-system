"use client";

type AnyObj = Record<string, unknown>;

const CHANNEL_NAME = "mis:app-events";
const STORAGE_PREFIX = "mis:event:";

type AppEventMessage = {
  type: string;
  detail?: AnyObj;
  ts: number;
};

let sharedChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (sharedChannel) return sharedChannel;
  sharedChannel = new BroadcastChannel(CHANNEL_NAME);
  return sharedChannel;
}

export function emitAppEvent(type: string, detail?: AnyObj): void {
  if (typeof window === "undefined") return;

  const payload: AppEventMessage = { type, detail, ts: Date.now() };

  // Same-tab listeners.
  window.dispatchEvent(new CustomEvent(type, { detail }));

  // Cross-tab listeners (modern browsers).
  try {
    const channel = getChannel();
    channel?.postMessage(payload);
  } catch {}

  // Cross-tab fallback (fires `storage` event in other tabs).
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${type}`, JSON.stringify(payload));
  } catch {}
}

export function subscribeAppEvent(type: string, handler: (detail?: AnyObj) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onWindow = (event: Event) => {
    handler((event as CustomEvent<AnyObj | undefined>).detail);
  };
  window.addEventListener(type, onWindow as EventListener);

  const channel = getChannel();
  const onChannelMessage = (event: MessageEvent<AppEventMessage>) => {
    const msg = event.data;
    if (!msg || msg.type !== type) return;
    handler(msg.detail);
  };
  channel?.addEventListener("message", onChannelMessage as EventListener);

  const storageKey = `${STORAGE_PREFIX}${type}`;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as AppEventMessage;
      if (parsed?.type !== type) return;
      handler(parsed.detail);
    } catch {}
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(type, onWindow as EventListener);
    channel?.removeEventListener("message", onChannelMessage as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

