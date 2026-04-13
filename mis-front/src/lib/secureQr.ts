export function buildQrAccessPath(token: string): string {
  return `/q/${encodeURIComponent(String(token ?? "").trim())}`;
}

export function buildQrAccessUrl(token: string, origin?: string | null): string {
  const path = buildQrAccessPath(token);
  const base =
    String(origin ?? "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!base) return path;

  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}
