"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/FormField";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CustomerRow } from "@/db/localDB";
import {
  customerCreate,
  customerDelete,
  customersListLocal,
  customersPullToLocal,
  customerUpdate,
} from "@/modules/customers/customers.repo";
import { resolveOfflineImageSrc } from "@/lib/imageThumb";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;

type CustomerStatus = "Active" | "VIP" | "Inactive";
type CustomerItem = CustomerRow & { status: CustomerStatus };

const STATUS_COLORS: Record<CustomerStatus, "blue" | "purple" | "slate"> = {
  Active: "blue",
  VIP: "purple",
  Inactive: "slate",
};

function normalizeStatus(value: string | null | undefined): CustomerStatus {
  const status = (value ?? "").trim().toLowerCase();
  if (status === "vip") return "VIP";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function toCustomerItem(row: CustomerRow): CustomerItem {
  return {
    ...row,
    status: normalizeStatus(row.status),
  };
}

export default function CustomersPage() {
  const [data, setData] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<CustomerItem>>({});
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);



  const loadLocal = useCallback(async () => {
    const local = await customersListLocal({
      page: 1,
      pageSize: LOCAL_LIST_PAGE_SIZE,
    });
    setData(local.items.map(toCustomerItem));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      try {
        await customersPullToLocal();
      } catch {}
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

    useEffect(() => {
      void refresh();
    }, [refresh]);

    useEffect(() => {
      const onSyncComplete = () => {
        void refresh();
      };
      window.addEventListener("sync:complete", onSyncComplete as EventListener);
      return () => {
        window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      };
  }, [refresh]);

  const columns = useMemo<Column<CustomerItem>[]>(
    () => [
      {
        key: "customer_image_url",
        label: "Image",
        render: (item) => {
          const initials = (item.name || "")
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0]?.toUpperCase())
            .join("")
            .slice(0, 2);
          const imageSrc = resolveOfflineImageSrc(item);

          return imageSrc ? (
            <img
              src={imageSrc}
              alt={item.name}
              className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-[#2a2a3e]"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#2a2a3e] dark:text-slate-300">
              {initials || "--"}
            </div>
          );
        },
      },
      {
        key: "name",
        label: "Customer",
        render: (item) => (
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-xs text-slate-500">{item.email || "-"}</div>
          </div>
        ),
      },
      {
        key: "phone",
        label: "Phone",
        render: (item) => <div className="font-medium">{item.phone}</div>,
      },
      {
        key: "status",
        label: "Status",
        render: (item) => <Badge color={STATUS_COLORS[item.status]}>{item.status}</Badge>,
      },
      {
        key: "activity",
        label: "Activity",
        render: (item) => (
          <Link
            href={`/customers/${item.uuid}/activity`}
            className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
          >
            View / Print
          </Link>
        ),
      },
    ],
    []
  );

  const handleSave = useCallback(async () => {
    if (saving) return;

    const name = (current.name ?? "").trim();
    const phone = (current.phone ?? "").trim();
    if (!name || !phone) {
      setFormError("Full name and phone number are required.");
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name,
        fname: (current.fname ?? "").trim() || null,
        gname: (current.gname ?? "").trim() || null,
        phone,
        phone1: (current.phone1 ?? "").trim() || null,
        email: (current.email ?? "").trim() || null,
        status: normalizeStatus(current.status),
        address: (current.address ?? "").trim() || null,
        attachment: attachmentFile,
      };
      if (current.uuid) {
        await customerUpdate(current.uuid, payload);
      } else {
        await customerCreate(payload);
      }
      setIsModalOpen(false);
      setCurrent({});
      setAttachmentFile(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [attachmentFile, current, refresh, saving]);

  const handleDelete = useCallback(async () => {
    if (!current.uuid) return;
    try {
      await customerDelete(current.uuid);
      setCurrent({});
      await refresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [current.uuid, refresh]);

  return (
    <RequirePermission permission="customers.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title="Customers" subtitle="Manage client relationships and profiles">
        <button
          type="button"
          onClick={() => {
            setCurrent({});
            setAttachmentFile(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Add Customer
        </button>
      </PageHeader>

        <DataTable
          columns={columns}
          data={data} 
          loading={loading}
          onEdit={(item) => {
            setFormError(null);
            setCurrent(item);
            setAttachmentFile(null);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            setCurrent(item);
            setIsDeleteOpen(true);
          }}
          searchKeys={["name", "email", "phone"]}
          pageSize={TABLE_PAGE_SIZE}
        />

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setFormError(null);
            setAttachmentFile(null);
          }}
          title={current.uuid ? "Edit Customer" : "Add New Customer"}
          size="lg"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Full Name"
              value={current.name ?? ""}
              onChange={(val) => setCurrent({ ...current, name: val as string })}
              required
            />
            <FormField
              label="Phone Number"
              value={current.phone ?? ""}
              onChange={(val) => setCurrent({ ...current, phone: val as string })}
              required
            />
            <FormField
              label="F/Name"
              value={current.fname ?? ""}
              onChange={(val) => setCurrent({ ...current, fname: val as string })}
            />
            <FormField
              label="G/Name"
              value={current.gname ?? ""}
              onChange={(val) => setCurrent({ ...current, gname: val as string })}
            />
            <FormField
              label="Second Number"
              value={current.phone1 ?? ""}
              onChange={(val) => setCurrent({ ...current, phone1: val as string })}
            />
            <FormField
              label="Email Address"
              type="email"
              value={current.email ?? ""}
              onChange={(val) => setCurrent({ ...current, email: val as string })}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachment</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(event) => {
                  setAttachmentFile(event.target.files?.[0] ?? null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
              />
              {attachmentFile && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{attachmentFile.name}</p>
              )}
            </div>
            <FormField
              label="Status"
              type="select"
              value={current.status ?? "Active"}
              onChange={(val) => setCurrent({ ...current, status: val as CustomerStatus })}
              options={[
                { value: "Active", label: "Active" },
                { value: "VIP", label: "VIP" },
                { value: "Inactive", label: "Inactive" },
              ]}
              required
            />
            <div className="md:col-span-2">
              <FormField
                label="Address"
                type="textarea"
                value={current.address ?? ""}
                onChange={(val) => setCurrent({ ...current, address: val as string })}
              />
            </div>
          </div>

          {formError && <div className="mt-4 text-sm text-red-600">{formError}</div>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
                setAttachmentFile(null);
              }}
              className="rounded-lg px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Delete Customer"
          message={`Are you sure you want to delete customer ${current.name ?? ""}? This action cannot be undone.`}
        />
      </div>
    </RequirePermission>
  );
}
