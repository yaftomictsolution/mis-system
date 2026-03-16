"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import RequirePermission from "@/components/auth/RequirePermission";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/modal";
import { type UserRow } from "@/db/localDB";
import {
  UserListLocal,
  userCreate,
  userDelete,
  userPullToLocal,
  userRoleOptions,
  userUpdate,
} from "@/modules/users/users.repo";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;

type UserViewRow = UserRow & { role?: string };

const emptyUser = (): Partial<UserViewRow> => ({});

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "--";

const formatDate = (value: number): string =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function UsersPage() {
  const [data, setData] = useState<UserViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [current, setCurrent] = useState<Partial<UserViewRow>>(emptyUser);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const resetCurrent = useCallback(() => setCurrent(emptyUser()), []);

  const loadLocal = useCallback(async () => {
    const local = await UserListLocal({ page: 1, pageSize: LOCAL_LIST_PAGE_SIZE });
    setData(local.items.map((item) => ({ ...item })));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      await userPullToLocal().catch(() => undefined);
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void userRoleOptions().then(setRoleOptions);
  }, []);

  useEffect(() => {
    const onSyncComplete = () => void refresh();
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFormError(null);
  }, []);

  const openCreate = useCallback(() => {
    resetCurrent();
    setFormError(null);
    setIsModalOpen(true);
  }, [resetCurrent]);

  const openEdit = useCallback((item: UserViewRow) => {
    setFormError(null);
    setCurrent({ ...item, role: item.role ?? item.roles?.[0] ?? "" });
    setIsModalOpen(true);
  }, []);

  const openDelete = useCallback((item: UserViewRow) => {
    setCurrent(item);
    setIsDeleteOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const name = (current.name ?? "").trim();
    if (!name) {
      setFormError("Full name is required.");
      return;
    }

    const selectedRole = (current.role ?? current.roles?.[0] ?? "").trim();
    const payload = {
      name,
      email: (current.email ?? "").trim() || null,
      password: (current.password ?? "").trim() || null,
      role: selectedRole || null,
      roles: selectedRole ? [selectedRole] : [],
    };

    setSaving(true);
    setFormError(null);
    try {
      if (current.uuid) {
        await userUpdate(current.uuid, payload);
      } else {
        await userCreate(payload);
      }
      closeModal();
      resetCurrent();
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [closeModal, current, refresh, resetCurrent, saving]);

  const handleDelete = useCallback(async () => {
    if (!current.uuid) return;
    try {
      await userDelete(current.uuid);
      setIsDeleteOpen(false);
      resetCurrent();
      await refresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [current.uuid, refresh, resetCurrent]);

  const columns = useMemo<Column<UserViewRow>[]>(
    () => [
      {
        key: "name",
        label: "Full Name",
        render: (item) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#2a2a3e] dark:text-slate-300">
              {getInitials(item.name || "")}
            </div>
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-slate-500">{item.email || "-"}</div>
            </div>
          </div>
        ),
      },
      {
        key: "role",
        label: "Role",
        render: (item) => {
          const names = item.roles ?? [];
          return names.length ? (
            <span className="text-sm text-slate-700 dark:text-slate-300">{names.join(", ")}</span>
          ) : (
            <span className="text-slate-400">-</span>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created At",
        render: (item) => <div className="font-medium">{formatDate(item.updated_at)}</div>,
      },
    ],
    []
  );

  return (
    <RequirePermission permission="customers.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Users" subtitle="Manage users and profiles">
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
          >
            <Plus size={18} /> Add User
          </button>
        </PageHeader>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          onEdit={openEdit}
          onDelete={openDelete}
          searchKeys={["name", "roles"]}
          pageSize={TABLE_PAGE_SIZE}
        />

        <Modal isOpen={isModalOpen} onClose={closeModal} title={current.uuid ? "Edit User" : "Add New User"}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Full Name"
              value={current.name ?? ""}
              onChange={(val) => setCurrent({ ...current, name: val as string })}
              required
            />
            <FormField
              label="Email Address"
              type="email"
              value={current.email ?? ""}
              onChange={(val) => setCurrent({ ...current, email: val as string })}
            />
            <FormField
              label="Password"
              type="password"
              value={current.password ?? ""}
              onChange={(val) => setCurrent({ ...current, password: val as string })}
            />
            <FormField
              label="Role"
              type="select"
              value={current.role ?? current.roles?.[0] ?? ""}
              options={roleOptions.map((role) => ({ value: role, label: role }))}
              placeholder="Select role"
              onChange={(val) => setCurrent({ ...current, role: val as string })}
            />
          </div>

          {formError && <div className="mt-4 text-sm text-red-600">{formError}</div>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
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
              {saving ? "Saving..." : "Save User"}
            </button>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Delete User"
          message={`Are you sure you want to delete user ${current.name ?? ""}? This action cannot be undone.`}
        />
      </div>
    </RequirePermission>
  );
}
