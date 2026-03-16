"use client";

import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import OfflinePolicyCountdowns from "@/components/layout/OfflinePolicyCountdowns";
import {
  DEFAULT_OFFLINE_POLICY,
  fromDateTimeLocalValue,
  getCachedOfflinePolicy,
  OFFLINE_POLICY_MODULE_LABELS,
  OFFLINE_POLICY_MODULES,
  offlinePolicyGet,
  offlinePolicySave,
  toDateTimeLocalValue,
  type OfflinePolicy,
} from "@/modules/offline-policy/offline-policy.repo";

type Props = {
  isAdmin: boolean;
};

function clonePolicy(policy: OfflinePolicy): OfflinePolicy {
  return {
    system_offline_until: policy.system_offline_until,
    unsynced_delete_at: policy.unsynced_delete_at,
    unsynced_retention_days: policy.unsynced_retention_days,
    module_retention_days: { ...policy.module_retention_days },
  };
}

export default function OfflinePolicyPanel({ isAdmin }: Props) {
  const [loading, setLoading] = useState(isAdmin);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OfflinePolicy>(clonePolicy(getCachedOfflinePolicy() ?? DEFAULT_OFFLINE_POLICY));

  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      setForm(clonePolicy(getCachedOfflinePolicy()));

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const policy = await offlinePolicyGet();
        setForm(clonePolicy(policy));
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
            ?.message ||
          "Failed to load offline policy.";
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };

    const onPolicyChanged = () => {
      setForm(clonePolicy(getCachedOfflinePolicy()));
    };

    window.addEventListener("offline-policy:changed", onPolicyChanged as EventListener);
    void load();
    return () => {
      window.removeEventListener("offline-policy:changed", onPolicyChanged as EventListener);
    };
  }, [isAdmin]);

  const dateFields = useMemo(
    () => ({
      system_offline_until: toDateTimeLocalValue(form.system_offline_until),
      unsynced_delete_at: toDateTimeLocalValue(form.unsynced_delete_at),
    }),
    [form.system_offline_until, form.unsynced_delete_at],
  );

  if (!isAdmin) return null;

  const updateModuleDays = (module: keyof OfflinePolicy["module_retention_days"], value: string) => {
    const parsed = Number(value);
    setForm((prev) => ({
      ...prev,
      module_retention_days: {
        ...prev.module_retention_days,
        [module]: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await offlinePolicySave(form);
      setForm(clonePolicy(saved));
      notifySuccess("Offline policy saved.");
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
      const message = data?.message || Object.values(data?.errors ?? {})[0]?.[0] || "Failed to save offline policy.";
      notifyError(String(message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Offline Policy</p>
          <p className="mt-1 text-xs text-slate-500">
            Admin controls how long each module stays usable offline and when unsynced data is deleted.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading offline policy...</p>
      ) : (
        <>
          <div className="mt-4">
            <OfflinePolicyCountdowns variant="panel" />
          </div>

          {typeof navigator !== "undefined" && !navigator.onLine ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              Using cached offline policy. Saving changes requires internet.
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">System Offline Allowed Until</span>
              <input
                type="datetime-local"
                value={dateFields.system_offline_until}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    system_offline_until: fromDateTimeLocalValue(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Delete Unsynced Records At</span>
              <input
                type="datetime-local"
                value={dateFields.unsynced_delete_at}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    unsynced_delete_at: fromDateTimeLocalValue(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs text-slate-500">Unsynced Record Retention (Days)</span>
              <input
                type="number"
                min={0}
                value={form.unsynced_retention_days}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    unsynced_retention_days: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Per Module Retention</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {OFFLINE_POLICY_MODULES.map((module) => (
                <label key={module} className="block">
                  <span className="mb-1 block text-xs text-slate-500">{OFFLINE_POLICY_MODULE_LABELS[module]}</span>
                  <input
                    type="number"
                    min={0}
                    value={form.module_retention_days[module]}
                    onChange={(event) => updateModuleDays(module, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Offline Policy"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
