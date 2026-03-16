"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { subscribeAppEvent } from "@/lib/appEvents";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifyError, notifySuccess } from "@/lib/notify";
import { CrmMessageForm, type CrmFormData } from "@/components/crm/CrmMessageForm";
import { CrmMessagesTable } from "@/components/crm/CrmMessagesTable";
import {
  crmMessageCreate,
  crmMessageRetry,
  crmMessagesList,
  crmRunInstallmentReminders,
  type CrmMessageRow,
  type CrmReminderRunStats,
} from "@/modules/crm/crm.repo";
import { customersListLocal, customersPullToLocal } from "@/modules/customers/customers.repo";

type CustomerOption = {
  id: number;
  label: string;
};

const EMPTY_FORM: CrmFormData = {
  customer_id: "",
  channel: "email",
  message_type: "installment_due",
};

export default function CrmPage() {
  const [form, setForm] = useState<CrmFormData>(EMPTY_FORM);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [rows, setRows] = useState<CrmMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningReminder, setRunningReminder] = useState(false);
  const [lastRun, setLastRun] = useState<CrmReminderRunStats | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      await customersPullToLocal();
    } catch {}
    const local = await customersListLocal({ page: 1, pageSize: 500 });
    setCustomers(
      local.items
        .filter((item) => Number(item.id) > 0)
        .map((item) => ({ id: Number(item.id), label: `${item.name} (${item.phone})` })),
    );
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const page = await crmMessagesList({ page: 1, perPage: 200 });
      setRows(page.items);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCustomers(), loadMessages()]);
  }, [loadCustomers, loadMessages]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const onSyncComplete = () => {
      void loadMessages();
    };
    const unsubscribeCrm = subscribeAppEvent("crm:changed", () => {
      void loadMessages();
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeCrm();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadMessages]);

  const customerCount = useMemo(() => customers.length, [customers.length]);

  const handleSend = useCallback(async () => {
    if (saving) return;

    const customerId = Number(form.customer_id);
    const messageType = form.message_type.trim();
    if (!customerId) {
      notifyError("Please select customer.");
      return;
    }
    if (!messageType) {
      notifyError("Message type is required.");
      return;
    }

    setSaving(true);
    try {
      const saved = await crmMessageCreate({
        customer_id: customerId,
        channel: form.channel,
        message_type: messageType,
      });
      notifySuccess(saved.local_only ? "CRM message queued offline. It will send when online." : "CRM message sent.");
      setForm((prev) => ({ ...prev, message_type: "installment_due" }));
      await loadMessages();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to send CRM message.");
    } finally {
      setSaving(false);
    }
  }, [form, loadMessages, saving]);

  const handleRetry = useCallback(async (row: CrmMessageRow) => {
    if (row.status !== "failed") return;
    try {
      const saved = await crmMessageRetry(row.id);
      notifySuccess(saved.local_only ? "CRM retry queued offline." : "CRM message retried.");
      await loadMessages();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Retry failed.");
    }
  }, [loadMessages]);

  const handleRunReminderNow = useCallback(async () => {
    if (runningReminder) return;
    setRunningReminder(true);
    try {
      const stats = await crmRunInstallmentReminders(10);
      setLastRun(stats);
      notifySuccess(`Reminder run complete. Sent: ${stats.sent}, Failed: ${stats.failed}.`);
      await loadMessages();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to run reminders.");
    } finally {
      setRunningReminder(false);
    }
  }, [loadMessages, runningReminder]);

  return (
    <RequirePermission permission="customers.view">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
        <PageHeader title="CRM" subtitle={`Send email/SMS and track delivery logs (${customerCount} customers)`}>
          <button
            type="button"
            onClick={() => {
              void handleRunReminderNow();
            }}
            disabled={runningReminder}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {runningReminder ? "Running..." : "Run 10-Day Reminder Now"}
          </button>
        </PageHeader>

        {lastRun && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {`Last run -> Checked: ${lastRun.checked}, Attempted: ${lastRun.attempted}, Sent: ${lastRun.sent}, Failed: ${lastRun.failed}, Skipped: ${lastRun.skipped}`}
          </div>
        )}

        <CrmMessageForm value={form} customers={customers} saving={saving} onChange={setForm} onSubmit={handleSend} />

        <CrmMessagesTable rows={rows} loading={loading} onRetry={handleRetry} />
      </div>
    </RequirePermission>
  );
}
