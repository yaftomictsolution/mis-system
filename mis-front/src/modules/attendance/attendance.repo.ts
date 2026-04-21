import { db } from "@/db/localDB";
import { api } from "@/lib/api";

export type BiometricAttendanceProvider =
  | "not-configured"
  | "demo"
  | "zkteco-pull"
  | "bridge-api"
  | "csv-import";

export type EmployeeMatchField =
  | "employee_uuid"
  | "email"
  | "phone"
  | "biometric_user_id";

export type BridgeStatus = "not-configured" | "inactive" | "waiting" | "online" | "offline";

export type BiometricAttendanceConfig = {
  provider: BiometricAttendanceProvider;
  device_label: string;
  ip_address: string | null;
  port: number;
  api_base_url: string | null;
  device_key: string | null;
  serial_number: string | null;
  timezone: string;
  sync_interval_minutes: number;
  employee_match_field: EmployeeMatchField;
  auto_sync_enabled: boolean;
  is_active: boolean;
  notes: string | null;
  last_validated_at: string | null;
  last_sync_at: string | null;
  supports_biometric_user_id: boolean;
  bridge_status: BridgeStatus;
};

export type AttendanceDashboardRow = {
  id: string;
  employee_uuid: string;
  employee_name: string;
  employee_job_title: string | null;
  biometric_user_id: string | null;
  first_check_in: string | null;
  last_check_out: string | null;
  total_events: number;
  status: "present" | "absent" | "incomplete";
  source_label: string;
};

export type AttendanceDashboard = {
  date: string;
  config: Partial<BiometricAttendanceConfig>;
  configured: boolean;
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  incompleteCount: number;
  unmatchedCount: number;
  rows: AttendanceDashboardRow[];
};

type CachedResult<T> = {
  data: T;
  fromCache: boolean;
};

type AttendanceValidationResult = {
  message: string;
  data: BiometricAttendanceConfig;
  details?: Record<string, unknown>;
};

type AttendanceSyncResult = {
  message: string;
  data: BiometricAttendanceConfig;
  bridge_response?: Record<string, unknown>;
};

const CONFIG_CACHE_KEY = "attendance_biometric_config_v1";
const DASHBOARD_CACHE_PREFIX = "attendance_dashboard_v1";
const CONFIG_TTL_SECONDS = 60 * 60;
const DASHBOARD_TTL_SECONDS = 5 * 60;

const isOnline = (): boolean => typeof navigator !== "undefined" && navigator.onLine;
const nowIso = (): string => new Date().toISOString();
const asObj = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function trimText(value: unknown, max = 255): string {
  return String(value ?? "").trim().slice(0, max);
}

function trimOrNull(value: unknown, max = 255): string | null {
  const trimmed = trimText(value, max);
  return trimmed || null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function toIsoOrNull(value: unknown): string | null {
  const raw = trimText(value, 100);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeProvider(value: unknown): BiometricAttendanceProvider {
  const provider = trimText(value, 50).toLowerCase();
  if (
    provider === "demo" ||
    provider === "zkteco-pull" ||
    provider === "bridge-api" ||
    provider === "csv-import"
  ) {
    return provider;
  }
  return "not-configured";
}

export function deriveBridgeStatus(config: Partial<BiometricAttendanceConfig>): BridgeStatus {
  const provider = normalizeProvider(config.provider);
  if (provider === "not-configured") return "not-configured";
  if (!config.is_active) return "inactive";

  const lastSync = Date.parse(String(config.last_sync_at ?? ""));
  if (!Number.isFinite(lastSync)) return "waiting";

  const syncIntervalMinutes = Math.max(5, toNumber(config.sync_interval_minutes, 15));
  const healthyWindowMs = syncIntervalMinutes * 2 * 60 * 1000;
  return Date.now() - lastSync <= healthyWindowMs ? "online" : "offline";
}

function normalizeMatchField(
  value: unknown,
  supportsBiometricUserId: boolean,
): EmployeeMatchField {
  const field = trimText(value, 50).toLowerCase();
  if (field === "email" || field === "phone" || field === "employee_uuid") {
    return field;
  }
  if (field === "biometric_user_id" && supportsBiometricUserId) {
    return "biometric_user_id";
  }
  return "employee_uuid";
}

function normalizeConfig(input: unknown): BiometricAttendanceConfig {
  const row = asObj(input);
  const supportsBiometricUserId = toBoolean(row.supports_biometric_user_id);
  const base: BiometricAttendanceConfig = {
    provider: normalizeProvider(row.provider),
    device_label: trimText(row.device_label, 120),
    ip_address: trimOrNull(row.ip_address, 120),
    port: toNumber(row.port, 4370),
    api_base_url: trimOrNull(row.api_base_url, 255),
    device_key: trimOrNull(row.device_key, 255),
    serial_number: trimOrNull(row.serial_number, 120),
    timezone: trimText(row.timezone, 120) || "Asia/Kabul",
    sync_interval_minutes: Math.max(1, toNumber(row.sync_interval_minutes, 15)),
    employee_match_field: normalizeMatchField(row.employee_match_field, supportsBiometricUserId),
    auto_sync_enabled: toBoolean(row.auto_sync_enabled),
    is_active: toBoolean(row.is_active),
    notes: trimOrNull(row.notes, 2000),
    last_validated_at: toIsoOrNull(row.last_validated_at),
    last_sync_at: toIsoOrNull(row.last_sync_at),
    supports_biometric_user_id: supportsBiometricUserId,
    bridge_status: "waiting",
  };

  const bridgeStatus = trimText(row.bridge_status, 50) as BridgeStatus;
  base.bridge_status =
    bridgeStatus === "not-configured" ||
    bridgeStatus === "inactive" ||
    bridgeStatus === "waiting" ||
    bridgeStatus === "online" ||
    bridgeStatus === "offline"
      ? bridgeStatus
      : deriveBridgeStatus(base);

  return base;
}

function normalizeDashboardRow(input: unknown): AttendanceDashboardRow {
  const row = asObj(input);
  const status = trimText(row.status, 30).toLowerCase();
  return {
    id: trimText(row.id, 100) || crypto.randomUUID(),
    employee_uuid: trimText(row.employee_uuid, 100),
    employee_name: trimText(row.employee_name, 255) || "Employee",
    employee_job_title: trimOrNull(row.employee_job_title, 255),
    biometric_user_id: trimOrNull(row.biometric_user_id, 255),
    first_check_in: toIsoOrNull(row.first_check_in),
    last_check_out: toIsoOrNull(row.last_check_out),
    total_events: toNumber(row.total_events, 0),
    status: status === "present" || status === "incomplete" ? status : "absent",
    source_label: trimText(row.source_label, 255) || "Attendance source",
  };
}

function normalizeDashboard(input: unknown): AttendanceDashboard {
  const row = asObj(input);
  return {
    date: trimText(row.date, 20) || new Date().toISOString().slice(0, 10),
    config: normalizeConfig(row.config),
    configured: toBoolean(row.configured),
    totalEmployees: toNumber(row.totalEmployees, 0),
    presentCount: toNumber(row.presentCount, 0),
    absentCount: toNumber(row.absentCount, 0),
    incompleteCount: toNumber(row.incompleteCount, 0),
    unmatchedCount: toNumber(row.unmatchedCount, 0),
    rows: asArray(row.rows).map(normalizeDashboardRow),
  };
}

async function readCache<T>(key: string): Promise<CachedResult<T> | null> {
  const cached = await db.api_cache.get(key);
  if (!cached) return null;
  return {
    data: cached.data as T,
    fromCache: true,
  };
}

async function writeCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  await db.api_cache.put({
    key,
    data,
    updated_at: Date.now(),
    ttl_seconds: ttlSeconds,
  });
}

function dashboardCacheKey(date: string): string {
  return `${DASHBOARD_CACHE_PREFIX}:${date}`;
}

function normalizeConfigPayload(input: Partial<BiometricAttendanceConfig>): Record<string, unknown> {
  const supportsBiometricUserId = Boolean(input.supports_biometric_user_id);
  return {
    provider: normalizeProvider(input.provider),
    device_label: trimText(input.device_label, 120),
    ip_address: trimOrNull(input.ip_address, 120),
    port: Math.max(1, toNumber(input.port, 4370)),
    api_base_url: trimOrNull(input.api_base_url, 255),
    device_key: trimOrNull(input.device_key, 255),
    serial_number: trimOrNull(input.serial_number, 120),
    timezone: trimText(input.timezone, 120) || "Asia/Kabul",
    sync_interval_minutes: Math.max(1, toNumber(input.sync_interval_minutes, 15)),
    employee_match_field: normalizeMatchField(input.employee_match_field, supportsBiometricUserId),
    auto_sync_enabled: Boolean(input.auto_sync_enabled),
    is_active: Boolean(input.is_active),
    notes: trimOrNull(input.notes, 2000),
  };
}

export async function biometricAttendanceGetConfig(): Promise<CachedResult<BiometricAttendanceConfig>> {
  if (!isOnline()) {
    const cached = await readCache<BiometricAttendanceConfig>(CONFIG_CACHE_KEY);
    if (cached) return cached;
    throw new Error("Biometric attendance settings are unavailable offline.");
  }

  try {
    const res = await api.get("/api/settings/biometric-attendance");
    const config = normalizeConfig(asObj(res.data).data);
    await writeCache(CONFIG_CACHE_KEY, config, CONFIG_TTL_SECONDS);
    return { data: config, fromCache: false };
  } catch (error) {
    const cached = await readCache<BiometricAttendanceConfig>(CONFIG_CACHE_KEY);
    if (cached) return cached;
    throw error;
  }
}

export async function biometricAttendanceSaveConfig(
  input: Partial<BiometricAttendanceConfig>,
): Promise<BiometricAttendanceConfig> {
  if (!isOnline()) {
    throw new Error("Biometric attendance settings can only be saved while online.");
  }
  const payload = normalizeConfigPayload(input);
  const res = await api.put("/api/settings/biometric-attendance", payload);
  const saved = normalizeConfig(asObj(res.data).data);
  await writeCache(CONFIG_CACHE_KEY, saved, CONFIG_TTL_SECONDS);
  return saved;
}

export async function biometricAttendanceValidateConfig(
  input: Partial<BiometricAttendanceConfig>,
): Promise<AttendanceValidationResult> {
  if (!isOnline()) {
    throw new Error("Connection validation requires internet access.");
  }
  const payload = normalizeConfigPayload(input);
  const res = await api.post("/api/settings/biometric-attendance/validate", payload);
  const body = asObj(res.data);
  const config = normalizeConfig(body.data);
  await writeCache(CONFIG_CACHE_KEY, config, CONFIG_TTL_SECONDS);
  return {
    message: trimText(body.message, 255) || "Validation completed.",
    data: config,
    details: asObj(body.details),
  };
}

export async function biometricAttendanceSyncNow(
  input: Partial<BiometricAttendanceConfig> & { date?: string | null },
): Promise<AttendanceSyncResult> {
  if (!isOnline()) {
    throw new Error("Manual sync requires internet access.");
  }
  const payload = {
    ...normalizeConfigPayload(input),
    date: trimOrNull(input.date, 20),
  };
  const res = await api.post("/api/settings/biometric-attendance/sync", payload);
  const body = asObj(res.data);
  const config = normalizeConfig(body.data);
  await writeCache(CONFIG_CACHE_KEY, config, CONFIG_TTL_SECONDS);
  return {
    message: trimText(body.message, 255) || "Sync requested.",
    data: config,
    bridge_response: asObj(body.bridge_response),
  };
}

export async function biometricAttendanceClearDemoPunches(date?: string | null): Promise<string> {
  if (!isOnline()) {
    throw new Error("Clearing demo punches requires internet access.");
  }
  const res = await api.delete("/api/settings/biometric-attendance/demo-punches", {
    data: {
      date: trimOrNull(date, 20),
    },
  });
  return trimText(asObj(res.data).message, 255) || "Demo punches cleared.";
}

export async function attendanceDashboardGet(date?: string | null): Promise<CachedResult<AttendanceDashboard>> {
  const normalizedDate = trimText(date, 20) || new Date().toISOString().slice(0, 10);
  const cacheKey = dashboardCacheKey(normalizedDate);

  if (!isOnline()) {
    const cached = await readCache<AttendanceDashboard>(cacheKey);
    if (cached) return cached;
    throw new Error("Attendance dashboard is unavailable offline.");
  }

  try {
    const res = await api.get("/api/attendance", {
      params: {
        date: normalizedDate,
      },
    });
    const dashboard = normalizeDashboard(asObj(res.data).data);
    await writeCache(cacheKey, dashboard, DASHBOARD_TTL_SECONDS);
    return { data: dashboard, fromCache: false };
  } catch (error) {
    const cached = await readCache<AttendanceDashboard>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

export function formatAttendanceTime(value?: string | null): string {
  const raw = trimText(value, 100);
  if (!raw) return "-";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

export function formatAttendanceDateTime(value?: string | null): string {
  const raw = trimText(value, 100);
  if (!raw) return "Never";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

export function emptyBiometricAttendanceConfig(): BiometricAttendanceConfig {
  return normalizeConfig({
    provider: "not-configured",
    timezone: "Asia/Kabul",
    sync_interval_minutes: 15,
    employee_match_field: "employee_uuid",
    auto_sync_enabled: false,
    is_active: false,
    notes: null,
    last_validated_at: null,
    last_sync_at: null,
    supports_biometric_user_id: false,
  });
}

export function todayDateInput(): string {
  return nowIso().slice(0, 10);
}
