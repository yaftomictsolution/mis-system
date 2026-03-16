import { db, type ApartmentRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";
import { createImageThumbFromUrl } from "@/lib/imageThumb";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const MAX_LOCAL_TEXT = 4000;
const CURSOR_KEY = "apartments_sync_cursor";
const CLEANUP_KEY = "apartments_last_cleanup_ms";
const IMAGE_BACKFILL_KEY = "apartments_image_backfill_v1";

type Obj = Record<string, unknown>;

export type ApartmentsLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type ApartmentsLocalPage = {
  items: ApartmentRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const nowIso = () => new Date().toISOString();

function getLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function getLsNum(key: string): number | null {
  const raw = getLs(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const d = Date.parse(String(v ?? ""));
  return Number.isFinite(d) ? d : Date.now();
}

function trimText(v: unknown, max = 255): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function trimOrNull(v: unknown, max = 255): string | null {
  if (typeof v !== "string") return null;
  const text = v.trim().slice(0, max);
  return text || null;
}

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

function toArea(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function toMoney(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const t = String(v ?? "").trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function normalizeUsageType(v: unknown): string {
  return String(v ?? "").trim().toLowerCase() === "commercial" ? "commercial" : "residential";
}

function normalizeStatus(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "reserved" || s === "handed_over" || s === "sold" || s === "rented" || s === "company_use") return s;
  return "available";
}

function firstApartmentImageUrl(input: unknown): string | null {
  const root = obj(input);
  const documents = Array.isArray(root.documents) ? root.documents : [];
  const imageCandidates: Array<{ fileUrl: string; createdAt: number }> = [];

  for (const item of documents) {
    const row = obj(item);
    const documentType = String(row.document_type ?? "").trim().toLowerCase();
    const fileUrl = String(row.file_url ?? row.download_url ?? "").trim();
    const filePath = String(row.file_path ?? "").trim().toLowerCase();
    const createdAt = toTs(row.created_at ?? 0);

    if (documentType === "apartment_image" && fileUrl) {
      imageCandidates.push({ fileUrl, createdAt });
      continue;
    }

    if (!documentType && (/\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(fileUrl) || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(filePath))) {
      imageCandidates.push({
        fileUrl: fileUrl || String(row.file_path ?? "").trim(),
        createdAt,
      });
    }
  }

  return imageCandidates.sort((a, b) => b.createdAt - a.createdAt)[0]?.fileUrl ?? null;
}

async function attachOfflineApartmentThumb(
  row: ApartmentRow,
  fallbackThumb?: string | null,
  forceRefreshFromUrl = false,
): Promise<ApartmentRow> {
  let apartmentImageThumb = row.apartment_image_thumb ?? fallbackThumb ?? null;

  if (row.apartment_image_url && (!apartmentImageThumb || forceRefreshFromUrl)) {
    const fetchedThumb = await createImageThumbFromUrl(row.apartment_image_url);
    if (fetchedThumb) {
      apartmentImageThumb = fetchedThumb;
    }
  }

  if (!apartmentImageThumb) return row;
  return { ...row, apartment_image_thumb: apartmentImageThumb };
}

function deriveIdFromUuid(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i += 1) {
    hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function toRowId(v: unknown, uuid: string): number {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  return deriveIdFromUuid(uuid);
}

function sanitizeApartment(input: unknown): ApartmentRow {
  const r = obj(input);
  const uuid = String(r.uuid ?? "");
  return {
    id: toRowId(r.id, uuid),
    uuid,
    apartment_code: trimText(r.apartment_code, 100).toUpperCase(),
    total_price: toMoney(r.total_price ?? r.price),
    apartment_image_url: firstApartmentImageUrl(r),
    apartment_image_thumb: trimOrNull(r.apartment_image_thumb, MAX_LOCAL_TEXT),
    usage_type: normalizeUsageType(r.usage_type),
    block_number: trimText(r.block_number, 50),
    unit_number: trimText(r.unit_number, 50),
    floor_number: trimText(r.floor_number, 50),
    bathrooms: toInt(r.bathrooms),
    bedrooms: toInt(r.bedrooms),
    halls: toInt(r.halls),
    kitchens: toInt(r.kitchens),
    balcony: toBool(r.balcony),
    area_sqm: toArea(r.area_sqm),
    apartment_shape: trimText(r.apartment_shape, 100),
    corridor: trimText(r.corridor, 100),
    qr_code: trimText(r.qr_code, 255),
    additional_info: trimText(r.additional_info, MAX_LOCAL_TEXT),
    status: normalizeStatus(r.status),
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
  };
}

function isDeletedRecord(input: unknown): boolean {
  const r = obj(input);
  return r.deleted_at !== null && r.deleted_at !== undefined && String(r.deleted_at).trim() !== "";
}

function validateApartment(row: ApartmentRow): void {
  if (!row.apartment_code) throw new Error("Apartment code is required.");
  if (!row.unit_number) throw new Error("Unit number is required.");
  if (!row.usage_type) throw new Error("Usage type is required.");
  if (!Number.isFinite(row.area_sqm) || row.area_sqm < 0) {
    throw new Error("Area must be a non-negative number.");
  }
}

async function assertNoDuplicate(row: ApartmentRow, ignoreUuid?: string): Promise<void> {
  const code = row.apartment_code.toLowerCase();
  const duplicate = await db.apartments
    .filter((item) => (item.apartment_code ?? "").toLowerCase() === code && item.uuid !== ignoreUuid)
    .first();

  if (duplicate) {
    throw new Error("Apartment code already exists.");
  }
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const v = (data.errors as Obj)[key];
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    }
  }

  return "Validation failed on server.";
}

const isValidationError = (status?: number) => status === 409 || status === 422;

async function removeLatestQueueItem(uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((i) => i.entity === "apartments" && i.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}

async function removeQueuedOpsForEntityUuids(entity: string, uuids: string[]): Promise<void> {
  const unique = [...new Set(uuids.filter(Boolean))];
  if (!unique.length) return;

  const ids: number[] = [];
  for (const uuid of unique) {
    const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
    for (const item of items) {
      if (item.entity === entity && item.id !== undefined) {
        ids.push(item.id);
      }
    }
  }

  if (ids.length) {
    await db.sync_queue.bulkDelete(ids);
  }
}

function matchesSearch(row: ApartmentRow, q: string): boolean {
  return [
    row.apartment_code,
    row.usage_type,
    row.block_number,
    row.unit_number,
    row.floor_number,
    row.bedrooms,
    row.halls,
    row.bathrooms,
    row.kitchens,
    row.status,
    row.apartment_shape,
    row.corridor,
    row.additional_info,
  ].some((v) => (v ?? "").toString().toLowerCase().includes(q));
}

function parseApartmentsPayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(obj), hasMore: false, serverTime: nowIso() };
  }

  const root = obj(payload);
  const meta = obj(root.meta);
  const topData = root.data;

  if (Array.isArray(topData)) {
    return {
      list: topData.map(obj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  const paged = obj(topData);
  const nested = paged.data;
  if (Array.isArray(nested)) {
    const current = Number(paged.current_page ?? 1);
    const last = Number(paged.last_page ?? 1);

    return {
      list: nested.map(obj),
      hasMore: current < last,
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  return { list: [], hasMore: false, serverTime: nowIso() };
}

export async function apartmentsListLocal(query: ApartmentsLocalQuery = {}): Promise<ApartmentsLocalPage> {
  await apartmentsRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();

  if (!q) {
    const total = await db.apartments.count();
    const items = await db.apartments.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const c = db.apartments.orderBy("updated_at").reverse().filter((row) => matchesSearch(row, q));
  const total = await c.count();
  const items = await c.offset(offset).limit(pageSize).toArray();

  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function apartmentsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const shouldRunImageBackfill = !getLs(IMAGE_BACKFILL_KEY);
  const since = shouldRunImageBackfill ? null : getLs(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/apartments", { params });
    const parsed = parseApartmentsPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.apartments.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("apartments", deletedUuids);
    }

    const nextRows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeApartment)
      .filter((r) => r.uuid && r.apartment_code && r.unit_number);

    const existingRows = await db.apartments.bulkGet(nextRows.map((row) => row.uuid));
    const rows = await Promise.all(
      nextRows.map((row, index) => {
        const existing = existingRows[index];
        const fallbackThumb =
          row.apartment_image_url === existing?.apartment_image_url ? existing?.apartment_image_thumb ?? null : null;

        return attachOfflineApartmentThumb(
          row,
          fallbackThumb,
          Boolean(row.apartment_image_url && row.apartment_image_url !== existing?.apartment_image_url)
        );
      })
    );

    if (rows.length) {
      await db.apartments.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  setLs(CURSOR_KEY, serverTime);
  if (shouldRunImageBackfill) {
    setLs(IMAGE_BACKFILL_KEY, "1");
  }
  await apartmentsRetentionCleanupIfDue();

  return { pulled };
}

function toApartmentApiPayload(row: ApartmentRow): Obj {
  return {
    uuid: row.uuid,
    apartment_code: row.apartment_code,
    total_price: row.total_price ?? 0,
    usage_type: row.usage_type,
    block_number: row.block_number,
    unit_number: row.unit_number,
    floor_number: row.floor_number,
    bedrooms: row.bedrooms,
    halls: row.halls,
    bathrooms: row.bathrooms,
    kitchens: row.kitchens,
    balcony: row.balcony,
    area_sqm: row.area_sqm,
    apartment_shape: row.apartment_shape,
    corridor: row.corridor,
    qr_code: row.qr_code,
    additional_info: row.additional_info,
    status: row.status,
    updated_at: row.updated_at,
  };
}

function pickSavedOrFallback(saved: ApartmentRow, fallback: ApartmentRow): ApartmentRow {
  if (!saved.uuid || !saved.apartment_code || !saved.unit_number) {
    return fallback;
  }
  return saved;
}

export async function apartmentCreate(payload: unknown): Promise<ApartmentRow> {
  const uuid = crypto.randomUUID();
  const row = sanitizeApartment({ ...obj(payload), uuid, updated_at: Date.now() });

  validateApartment(row);
  await assertNoDuplicate(row);

  if (!isOnline()) {
    await db.apartments.put(row);
    await enqueueSync({
      entity: "apartments",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toApartmentApiPayload(row),
    });
    notifySuccess("Apartment saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/apartments", toApartmentApiPayload(row));
    const saved = pickSavedOrFallback(sanitizeApartment(obj(res.data).data ?? row), row);
    await db.apartments.put(saved);
    notifySuccess("Apartment created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.apartments.delete(uuid);
      await removeLatestQueueItem(uuid, "create");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.apartments.put(row);
    await enqueueSync({
      entity: "apartments",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toApartmentApiPayload(row),
    });
    notifyInfo("Apartment saved locally. Server sync will retry later.");
    return row;
  }
}

export async function apartmentUpdate(uuid: string, patch: unknown): Promise<ApartmentRow> {
  const existing = await db.apartments.get(uuid);
  if (!existing) throw new Error("Apartment not found locally");

  const updated = sanitizeApartment({ ...existing, ...obj(patch), uuid, updated_at: Date.now() });

  validateApartment(updated);
  await assertNoDuplicate(updated, uuid);

  await db.apartments.put(updated);
  await enqueueSync({
    entity: "apartments",
    uuid,
    localKey: uuid,
    action: "update",
    payload: toApartmentApiPayload(updated),
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Apartment updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/apartments/${uuid}`, toApartmentApiPayload(updated));
    const saved = pickSavedOrFallback(sanitizeApartment(obj(res.data).data ?? updated), updated);
    await db.apartments.put(saved);
    notifySuccess("Apartment updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.apartments.put(existing);
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    notifyInfo("Apartment updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function apartmentDelete(uuid: string): Promise<void> {
  const existing = await db.apartments.get(uuid);
  if (!existing) throw new Error("Apartment not found locally");

  await db.apartments.delete(uuid);
  await enqueueSync({
    entity: "apartments",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Apartment deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/apartments/${uuid}`);
    notifySuccess("Apartment deleted successfully.");
  } catch {
    notifyInfo("Apartment deleted locally. Server sync will retry later.");
  }
}

async function apartmentsRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("apartments", RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("apartments").toArray();
  const locked = new Set(pending.map((i) => i.uuid));

  const oldRows = await db.apartments.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((r) => !locked.has(r.uuid)).map((r) => r.uuid);

  if (removable.length) {
    await db.apartments.bulkDelete(removable);
  }

  return removable.length;
}

export async function apartmentsRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const last = getLsNum(CLEANUP_KEY);

  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await apartmentsRetentionCleanup();
  setLs(CLEANUP_KEY, String(now));
  return removed;
}
