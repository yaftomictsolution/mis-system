"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Shield,
  Wifi,
  WifiOff,
} from "lucide-react";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { hasAnyRole } from "@/lib/permissions";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { RootState } from "@/store/store";
import {
  attendanceDashboardGet,
  biometricAttendanceClearDemoPunches,
  biometricAttendanceGetConfig,
  biometricAttendanceSaveConfig,
  biometricAttendanceSyncNow,
  biometricAttendanceValidateConfig,
  deriveBridgeStatus,
  emptyBiometricAttendanceConfig,
  formatAttendanceDateTime,
  formatAttendanceTime,
  todayDateInput,
  type AttendanceDashboard,
  type AttendanceDashboardRow,
  type BiometricAttendanceConfig,
} from "@/modules/attendance/attendance.repo";

const TABLE_PAGE_SIZE = 12;
const ATTENDANCE_TTL_HINT = "Cached data remains visible offline. Saving, validating, and syncing require internet.";

function StatusPill({
  label,
  color,
}: {
  label: string;
  color: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
}) {
  return <Badge color={color}>{label}</Badge>;
}

function SummaryCard({
  title,
  value,
  helper,
  color,
}: {
  title: string;
  value: string | number;
  helper: string;
  color: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
        <StatusPill label={title} color={color} />
      </div>
      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{helper}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <div>
        <div className="font-medium text-slate-900 dark:text-white">{label}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{description}</div>
      </div>
    </label>
  );
}

function bridgeStatusMeta(status: string): {
  label: string;
  color: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
} {
  switch (status) {
    case "online":
      return { label: "Online", color: "emerald" };
    case "offline":
      return { label: "Offline", color: "red" };
    case "inactive":
      return { label: "Inactive", color: "slate" };
    case "not-configured":
      return { label: "Not Configured", color: "purple" };
    default:
      return { label: "Waiting", color: "amber" };
  }
}

export default function AttendancePage() {
  const roles = useSelector((state: RootState) => state.auth.user?.roles ?? []);
  const isAdmin = hasAnyRole(roles, "Admin");
  const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  const [attendanceDate, setAttendanceDate] = useState(todayDateInput());
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);
  const [dashboardFromCache, setDashboardFromCache] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [config, setConfig] = useState<BiometricAttendanceConfig>(emptyBiometricAttendanceConfig());
  const [draftConfig, setDraftConfig] = useState<BiometricAttendanceConfig>(emptyBiometricAttendanceConfig());
  const [configFromCache, setConfigFromCache] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);

  const effectiveConfig = useMemo<BiometricAttendanceConfig>(
    () => ({
      ...emptyBiometricAttendanceConfig(),
      ...(dashboard?.config ?? {}),
      ...(isAdmin ? config : {}),
    }),
    [config, dashboard?.config, isAdmin],
  );

  const bridgeStatus = useMemo(
    () => bridgeStatusMeta(effectiveConfig.bridge_status || deriveBridgeStatus(effectiveConfig)),
    [effectiveConfig],
  );

  const attendanceColumns = useMemo<Column<AttendanceDashboardRow>[]>(
    () => [
      {
        key: "employee_name",
        label: "Employee",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white">{item.employee_name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {item.employee_job_title || "No job title"}
            </div>
          </div>
        ),
      },
      {
        key: "biometric_user_id",
        label: "Biometric ID",
        render: (item) => <span>{item.biometric_user_id || "-"}</span>,
      },
      {
        key: "first_check_in",
        label: "First Check-In",
        render: (item) => <span>{formatAttendanceTime(item.first_check_in)}</span>,
      },
      {
        key: "last_check_out",
        label: "Last Check-Out",
        render: (item) => <span>{formatAttendanceTime(item.last_check_out)}</span>,
      },
      {
        key: "total_events",
        label: "Events",
        render: (item) => <span>{item.total_events}</span>,
      },
      {
        key: "status",
        label: "Status",
        render: (item) => {
          if (item.status === "present") return <StatusPill label="Present" color="emerald" />;
          if (item.status === "incomplete") return <StatusPill label="Incomplete" color="amber" />;
          return <StatusPill label="Absent" color="red" />;
        },
      },
      {
        key: "source_label",
        label: "Source",
        render: (item) => <span>{item.source_label}</span>,
      },
    ],
    [],
  );

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const result = await attendanceDashboardGet(attendanceDate);
      setDashboard(result.data);
      setDashboardFromCache(result.fromCache);
    } catch (error: unknown) {
      setDashboardError(error instanceof Error ? error.message : "Failed to load attendance dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }, [attendanceDate]);

  const loadConfig = useCallback(async () => {
    if (!isAdmin) {
      setLoadingConfig(false);
      return;
    }

    setLoadingConfig(true);
    setConfigError(null);
    try {
      const result = await biometricAttendanceGetConfig();
      setConfig(result.data);
      setDraftConfig(result.data);
      setConfigFromCache(result.fromCache);
    } catch (error: unknown) {
      setConfigError(error instanceof Error ? error.message : "Failed to load biometric settings.");
    } finally {
      setLoadingConfig(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const refreshOnSync = () => {
      void loadDashboard();
      if (isAdmin) {
        void loadConfig();
      }
    };
    const refreshOnOnline = () => {
      void loadDashboard();
      if (isAdmin) {
        void loadConfig();
      }
    };

    window.addEventListener("sync:complete", refreshOnSync as EventListener);
    window.addEventListener("online", refreshOnOnline);

    return () => {
      window.removeEventListener("sync:complete", refreshOnSync as EventListener);
      window.removeEventListener("online", refreshOnOnline);
    };
  }, [isAdmin, loadConfig, loadDashboard]);

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await biometricAttendanceSaveConfig(draftConfig);
      setConfig(saved);
      setDraftConfig(saved);
      setConfigFromCache(false);
      notifySuccess("Biometric attendance settings saved.");
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to save biometric settings.");
    } finally {
      setSaving(false);
    }
  }, [draftConfig]);

  const handleValidateConfig = useCallback(async () => {
    setValidating(true);
    try {
      const result = await biometricAttendanceValidateConfig(draftConfig);
      setConfig(result.data);
      setDraftConfig(result.data);
      setConfigFromCache(false);
      notifySuccess(result.message);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  }, [draftConfig]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await biometricAttendanceSyncNow({
        ...draftConfig,
        date: attendanceDate,
      });
      setConfig(result.data);
      setDraftConfig(result.data);
      setConfigFromCache(false);
      notifySuccess(result.message);
      await loadDashboard();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Manual sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [attendanceDate, draftConfig, loadDashboard]);

  const handleClearDemoPunches = useCallback(async () => {
    setClearingDemo(true);
    try {
      const message = await biometricAttendanceClearDemoPunches(attendanceDate);
      notifySuccess(message);
      await loadDashboard();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to clear demo punches.");
    } finally {
      setClearingDemo(false);
    }
  }, [attendanceDate, loadDashboard]);

  const matchFieldOptions = useMemo(() => {
    const base = [
      { value: "employee_uuid", label: "Employee UUID" },
      { value: "email", label: "Employee Email" },
      { value: "phone", label: "Employee Phone" },
    ];

    if (draftConfig.supports_biometric_user_id) {
      base.unshift({ value: "biometric_user_id", label: "Employee Biometric ID" });
    }

    return base;
  }, [draftConfig.supports_biometric_user_id]);

  return (
    <RequirePermission permission="employees.view">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Attendance"
          subtitle="Monitor attendance online, keep cached visibility offline, and let admin control the biometric integration."
        >
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                void loadDashboard();
                if (isAdmin) {
                  void loadConfig();
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#1a1a2e] dark:text-slate-300 dark:hover:bg-[#2a2a3e] sm:w-auto"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </PageHeader>

        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Attendance Date</div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{attendanceDate}</div>
              </div>
              <div className="w-full sm:w-56">
                <FormField
                  label="Filter Date"
                  type="date"
                  value={attendanceDate}
                  onChange={(value) => setAttendanceDate(String(value))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="flex items-start gap-3">
              {dashboardFromCache || configFromCache || !browserOnline ? (
                <WifiOff className="mt-1 h-5 w-5 text-amber-500" />
              ) : (
                <Wifi className="mt-1 h-5 w-5 text-emerald-500" />
              )}
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {dashboardFromCache || configFromCache || !browserOnline ? "Offline / Cached View" : "Live View"}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ATTENDANCE_TTL_HINT}</div>
              </div>
            </div>
          </div>
        </div>

        {dashboardError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {dashboardError}
          </div>
        ) : null}

        {configError ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {configError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Present"
            value={dashboard?.presentCount ?? 0}
            helper="Employees with complete check-in and check-out."
            color="emerald"
          />
          <SummaryCard
            title="Absent"
            value={dashboard?.absentCount ?? 0}
            helper="Employees with no attendance events for the selected date."
            color="red"
          />
          <SummaryCard
            title="Incomplete"
            value={dashboard?.incompleteCount ?? 0}
            helper="Employees missing either check-in or check-out."
            color="amber"
          />
          <SummaryCard
            title="Unmatched"
            value={dashboard?.unmatchedCount ?? 0}
            helper="Punches received but not matched to any employee."
            color="purple"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Daily Attendance</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review employee status, biometric IDs, and recorded punch times.
                </p>
              </div>
              <StatusPill
                label={loadingDashboard ? "Loading..." : `${dashboard?.totalEmployees ?? 0} employees`}
                color="blue"
              />
            </div>

            <DataTable
              columns={attendanceColumns}
              data={dashboard?.rows ?? []}
              loading={loadingDashboard}
              searchKeys={[
                "employee_name",
                "employee_job_title",
                "biometric_user_id",
                "status",
                "source_label",
              ]}
              pageSize={TABLE_PAGE_SIZE}
              mobileStack
              noHorizontalScroll
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="mb-4 flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bridge Status</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    The dashboard is online, while the local bridge keeps punch delivery resilient.
                  </p>
                </div>
              </div>
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between gap-4">
                  <span>Provider</span>
                  <span className="font-medium">{effectiveConfig.provider || "not-configured"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Status</span>
                  <StatusPill label={bridgeStatus.label} color={bridgeStatus.color} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Last Validation</span>
                  <span className="text-right">{formatAttendanceDateTime(effectiveConfig.last_validated_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Last Sync / Ingest</span>
                  <span className="text-right">{formatAttendanceDateTime(effectiveConfig.last_sync_at)}</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
                  <div className="font-medium text-slate-900 dark:text-white">Recommended workflow</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>Admin configures the biometric provider and bridge key here.</li>
                    <li>The local bridge on the office network reads device punches.</li>
                    <li>If internet drops, the bridge queues punches locally and sends them later.</li>
                    <li>This page continues to show cached attendance data while offline.</li>
                  </ol>
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="mb-4 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Biometric Settings</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Only admin can change device connectivity and bridge configuration.
                    </p>
                  </div>
                </div>

                {loadingConfig ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Loading biometric settings...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        label="Provider"
                        type="select"
                        value={draftConfig.provider}
                        onChange={(value) =>
                          setDraftConfig((prev) => ({ ...prev, provider: String(value) as BiometricAttendanceConfig["provider"] }))
                        }
                        options={[
                          { value: "not-configured", label: "Not Configured" },
                          { value: "bridge-api", label: "Bridge API" },
                          { value: "zkteco-pull", label: "ZKTeco Pull" },
                          { value: "csv-import", label: "CSV Import" },
                          { value: "demo", label: "Demo" },
                        ]}
                      />
                      <FormField
                        label="Device Label"
                        value={draftConfig.device_label}
                        onChange={(value) => setDraftConfig((prev) => ({ ...prev, device_label: String(value) }))}
                        placeholder="Head office biometric bridge"
                      />

                      {draftConfig.provider === "bridge-api" ? (
                        <>
                          <FormField
                            label="Bridge API Base URL"
                            value={draftConfig.api_base_url ?? ""}
                            onChange={(value) =>
                              setDraftConfig((prev) => ({ ...prev, api_base_url: String(value) || null }))
                            }
                            placeholder="https://bridge.example.local"
                          />
                          <FormField
                            label="Bridge Key"
                            type="password"
                            value={draftConfig.device_key ?? ""}
                            onChange={(value) =>
                              setDraftConfig((prev) => ({ ...prev, device_key: String(value) || null }))
                            }
                            placeholder="Shared bridge secret"
                          />
                        </>
                      ) : null}

                      {draftConfig.provider === "zkteco-pull" ? (
                        <>
                          <FormField
                            label="Device IP Address"
                            value={draftConfig.ip_address ?? ""}
                            onChange={(value) =>
                              setDraftConfig((prev) => ({ ...prev, ip_address: String(value) || null }))
                            }
                            placeholder="192.168.1.201"
                          />
                          <FormField
                            label="Port"
                            type="number"
                            value={draftConfig.port}
                            onChange={(value) =>
                              setDraftConfig((prev) => ({ ...prev, port: Number(value) || 4370 }))
                            }
                          />
                        </>
                      ) : null}

                      <FormField
                        label="Serial Number"
                        value={draftConfig.serial_number ?? ""}
                        onChange={(value) =>
                          setDraftConfig((prev) => ({ ...prev, serial_number: String(value) || null }))
                        }
                        placeholder="Optional device serial"
                      />
                      <FormField
                        label="Timezone"
                        value={draftConfig.timezone}
                        onChange={(value) => setDraftConfig((prev) => ({ ...prev, timezone: String(value) }))}
                        placeholder="Asia/Kabul"
                      />
                      <FormField
                        label="Sync Interval (Minutes)"
                        type="number"
                        value={draftConfig.sync_interval_minutes}
                        onChange={(value) =>
                          setDraftConfig((prev) => ({ ...prev, sync_interval_minutes: Number(value) || 15 }))
                        }
                      />
                      <FormField
                        label="Employee Match Field"
                        type="select"
                        value={draftConfig.employee_match_field}
                        onChange={(value) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            employee_match_field: String(value) as BiometricAttendanceConfig["employee_match_field"],
                          }))
                        }
                        options={matchFieldOptions}
                      />
                    </div>

                    {!draftConfig.supports_biometric_user_id ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        Employee biometric ID matching will activate after the backend biometric employee field is available.
                      </div>
                    ) : null}

                    <FormField
                      label="Notes"
                      type="textarea"
                      value={draftConfig.notes ?? ""}
                      onChange={(value) => setDraftConfig((prev) => ({ ...prev, notes: String(value) || null }))}
                      placeholder="How the local bridge is installed, device model, office notes..."
                      rows={4}
                    />

                    <div className="grid gap-3">
                      <ToggleRow
                        label="Active"
                        description="Enable attendance ingestion for this configuration."
                        checked={draftConfig.is_active}
                        onChange={(next) => setDraftConfig((prev) => ({ ...prev, is_active: next }))}
                      />
                      <ToggleRow
                        label="Auto Sync"
                        description="Allow the bridge workflow to run on its configured sync interval."
                        checked={draftConfig.auto_sync_enabled}
                        onChange={(next) => setDraftConfig((prev) => ({ ...prev, auto_sync_enabled: next }))}
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-300">
                      The local bridge should post normalized punches to the public backend endpoint
                      <span className="ml-1 font-semibold text-slate-900 dark:text-white">/api/attendance/bridge/punches</span>
                      using the bridge key above.
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleSaveConfig()}
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Settings"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleValidateConfig()}
                        disabled={validating}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {validating ? "Validating..." : "Validate Connection"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSyncNow()}
                        disabled={syncing}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {syncing ? "Syncing..." : "Sync Now"}
                      </button>
                      {draftConfig.provider === "demo" ? (
                        <button
                          type="button"
                          onClick={() => void handleClearDemoPunches()}
                          disabled={clearingDemo}
                          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          {clearingDemo ? "Clearing..." : "Clear Demo Punches"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 h-5 w-5 text-amber-500" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Admin-only configuration</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Attendance monitoring is visible here, but only admin can change biometric device settings,
                      validate connectivity, or trigger bridge sync manually.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
