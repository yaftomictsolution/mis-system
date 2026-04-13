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

function buildInitials(value: string | null | undefined): string {
  return String(value ?? "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

function PersonThumb({
  imageSrc,
  name,
}: {
  imageSrc: string | null;
  name: string | null | undefined;
}) {
  const initials = buildInitials(name);

  return imageSrc ? (
    <img
      src={imageSrc}
      alt={String(name ?? "").trim() || "Representative"}
      className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-[#2a2a3e]"
    />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#2a2a3e] dark:text-slate-300">
      {initials || "--"}
    </div>
  );
}

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
  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null);
  const [representativePhotoFile, setRepresentativePhotoFile] = useState<File | null>(null);
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
          const imageSrc = resolveOfflineImageSrc(item);

          return <PersonThumb imageSrc={imageSrc} name={item.name} />;
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
        key: "representative",
        label: "Representative",
        render: (item) => {
          const representativeName = String(item.representative_name ?? "").trim();
          const representativePhone = String(item.representative_phone ?? "").trim() || "-";
          const representativeRelationship = String(item.representative_relationship ?? "").trim() || "-";
          const representativeImageSrc = resolveOfflineImageSrc({
            representative_image_url: item.customer_representative_image_url,
          });

          if (!representativeName && !String(item.customer_representative_image_url ?? "").trim()) {
            return <div className="text-xs text-slate-500">No representative</div>;
          }

          return (
            <div className="flex min-w-[240px] items-start gap-3">
              <PersonThumb imageSrc={representativeImageSrc} name={representativeName || "Representative"} />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  {representativeName || "Representative"}
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Phone:</span> {representativePhone}
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Relation:</span> {representativeRelationship}
                </div>
              </div>
            </div>
          );
        },
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
        job_title: (current.job_title ?? "").trim() || null,
        tazkira_number: (current.tazkira_number ?? "").trim() || null,
        phone,
        phone1: (current.phone1 ?? "").trim() || null,
        email: (current.email ?? "").trim() || null,
        status: normalizeStatus(current.status),
        address: (current.address ?? "").trim() || null,
        current_area: (current.current_area ?? "").trim() || null,
        current_district: (current.current_district ?? "").trim() || null,
        current_province: (current.current_province ?? "").trim() || null,
        original_area: (current.original_area ?? "").trim() || null,
        original_district: (current.original_district ?? "").trim() || null,
        original_province: (current.original_province ?? "").trim() || null,
        representative_name: (current.representative_name ?? "").trim() || null,
        representative_fname: (current.representative_fname ?? "").trim() || null,
        representative_gname: (current.representative_gname ?? "").trim() || null,
        representative_job_title: (current.representative_job_title ?? "").trim() || null,
        representative_relationship: (current.representative_relationship ?? "").trim() || null,
        representative_phone: (current.representative_phone ?? "").trim() || null,
        representative_tazkira_number: (current.representative_tazkira_number ?? "").trim() || null,
        representative_current_area: (current.representative_current_area ?? "").trim() || null,
        representative_current_district: (current.representative_current_district ?? "").trim() || null,
        representative_current_province: (current.representative_current_province ?? "").trim() || null,
        representative_original_area: (current.representative_original_area ?? "").trim() || null,
        representative_original_district: (current.representative_original_district ?? "").trim() || null,
        representative_original_province: (current.representative_original_province ?? "").trim() || null,
        customer_image_attachment: customerPhotoFile,
        customer_representative_image_attachment: representativePhotoFile,
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
      setCustomerPhotoFile(null);
      setRepresentativePhotoFile(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [attachmentFile, current, customerPhotoFile, refresh, representativePhotoFile, saving]);

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
            setCustomerPhotoFile(null);
            setRepresentativePhotoFile(null);
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
            setCustomerPhotoFile(null);
            setRepresentativePhotoFile(null);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            setCurrent(item);
            setIsDeleteOpen(true);
          }}
          searchKeys={["name", "email", "phone", "representative_name", "representative_phone", "representative_relationship"]}
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
              label="Job Title"
              value={current.job_title ?? ""}
              onChange={(val) => setCurrent({ ...current, job_title: val as string })}
            />
            <FormField
              label="Tazkira Number"
              value={current.tazkira_number ?? ""}
              onChange={(val) => setCurrent({ ...current, tazkira_number: val as string })}
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
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Buyer Residence</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used in the deed print layout.</div>
            </div>
            <FormField
              label="Current Village / Nahia"
              value={current.current_area ?? ""}
              onChange={(val) => setCurrent({ ...current, current_area: val as string })}
            />
            <FormField
              label="Current District"
              value={current.current_district ?? ""}
              onChange={(val) => setCurrent({ ...current, current_district: val as string })}
            />
            <FormField
              label="Current Province"
              value={current.current_province ?? ""}
              onChange={(val) => setCurrent({ ...current, current_province: val as string })}
            />
            <FormField
              label="Original Village / Nahia"
              value={current.original_area ?? ""}
              onChange={(val) => setCurrent({ ...current, original_area: val as string })}
            />
            <FormField
              label="Original District"
              value={current.original_district ?? ""}
              onChange={(val) => setCurrent({ ...current, original_district: val as string })}
            />
            <FormField
              label="Original Province"
              value={current.original_province ?? ""}
              onChange={(val) => setCurrent({ ...current, original_province: val as string })}
            />
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Representative</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fill this when the deed should print buyer representative details.</div>
            </div>
            <FormField
              label="Representative Name"
              value={current.representative_name ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_name: val as string })}
            />
            <FormField
              label="Representative Phone"
              value={current.representative_phone ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_phone: val as string })}
            />
            <FormField
              label="Representative Father Name"
              value={current.representative_fname ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_fname: val as string })}
            />
            <FormField
              label="Representative Grandfather Name"
              value={current.representative_gname ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_gname: val as string })}
            />
            <FormField
              label="Representative Job Title"
              value={current.representative_job_title ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_job_title: val as string })}
            />
            <FormField
              label="Relationship To Buyer"
              value={current.representative_relationship ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_relationship: val as string })}
            />
            <FormField
              label="Representative Tazkira Number"
              value={current.representative_tazkira_number ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_tazkira_number: val as string })}
            />
            <FormField
              label="Representative Current Village / Nahia"
              value={current.representative_current_area ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_current_area: val as string })}
            />
            <FormField
              label="Representative Current District"
              value={current.representative_current_district ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_current_district: val as string })}
            />
            <FormField
              label="Representative Current Province"
              value={current.representative_current_province ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_current_province: val as string })}
            />
            <FormField
              label="Representative Original Village / Nahia"
              value={current.representative_original_area ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_original_area: val as string })}
            />
            <FormField
              label="Representative Original District"
              value={current.representative_original_district ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_original_district: val as string })}
            />
            <FormField
              label="Representative Original Province"
              value={current.representative_original_province ?? ""}
              onChange={(val) => setCurrent({ ...current, representative_original_province: val as string })}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Buyer Photo</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(event) => {
                  setCustomerPhotoFile(event.target.files?.[0] ?? null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
              />
              {customerPhotoFile && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{customerPhotoFile.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Representative Photo</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(event) => {
                  setRepresentativePhotoFile(event.target.files?.[0] ?? null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
              />
              {representativePhotoFile && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{representativePhotoFile.name}</p>
              )}
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
                setCustomerPhotoFile(null);
                setRepresentativePhotoFile(null);
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
