"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/FormField";
import { UserRow } from "@/db/localDB";
import { userPullToLocal, UserListLocal, userRoleOptions, userUpdate, userCreate,userDelete } from "@/modules/users/users.repo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;
type UserViewRow = UserRow & { role?: string };

export default function UsersPage() {

  const [data, setData] = useState<UserViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Partial<UserViewRow>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const loadLocal = useCallback(async () => {
    const local = await UserListLocal({
      page: 1,
      pageSize: LOCAL_LIST_PAGE_SIZE,
    });
    setData(local.items.map((role) => ({ ...role })));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      try {
        await userPullToLocal();
      } catch { }
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

  const loadRoles = useCallback(async () => {
    const options = await userRoleOptions();
    setRoleOptions(options);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);


  const handleSave = useCallback(async () => {

    if (saving) return;
    const name = (current.name ?? "").trim();
    if (!name) {
      setFormError("Full name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const selectedRole = (current.role ?? current.roles?.[0] ?? "").trim();
      const payload = {
        name,
        email: (current.email ?? "").trim() || null,
        password: (current.password ?? "").trim() || null,
        role: selectedRole || null,
        roles: selectedRole ? [selectedRole] : [],
      };
      if (current.uuid) {
        await userUpdate(current.uuid, payload);
      } else {
        await userCreate(payload);
      }
      setIsModalOpen(false);
      setCurrent({});
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [current, refresh, saving]);

   const handleDelete = useCallback(async () => {
      if (!current.uuid) return;
      try {
        await userDelete(current.uuid);
        setIsDeleteOpen(false);
        setCurrent({});
        await refresh();
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }, [current.uuid, refresh]);

  const columns = useMemo<Column<UserViewRow>[]>(
    () => [
      {
        key: "name",
        label: "Full Name",
        render: (item) => {
          const initials = (item.name || "")

            .split(" ")
            .filter(Boolean)
            .map((n) => n[0]?.toUpperCase())
            .join("")
            .slice(0, 2);

          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#2a2a3e] dark:text-slate-300">
                {initials || "--"}
              </div>
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">{item.email || "-"}</div>
              </div>
            </div>
          );
        },
      },
      {
        key: "role",
        label: "Role",
        render: (item) => {
          const names = item.roles ?? [];
          if (!names.length) return <span className="text-slate-400">-</span>;
          return (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {names}
            </span>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created At",
        render: (item) => {
          const date = new Date(item.updated_at);
          const formattedDate = date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          return <div className="font-medium">{formattedDate}</div>;
        },
      },
    ],
    []
  );

  return (
    <RequirePermission permission="customers.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Customers" subtitle="Manage client relationships and profiles">
          <button type="button" onClick={() => { setCurrent({}); setIsModalOpen(true) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20">
            <Plus size={18} /> Add User
          </button>
        </PageHeader>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          onEdit={(item) => {
            setFormError(null);
            setCurrent({ ...item, role: item.role ?? item.roles?.[0] ?? "" });
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            setCurrent(item);
            setIsDeleteOpen(true);
          }}
          searchKeys={["name", "permissions"]}
          pageSize={TABLE_PAGE_SIZE} />

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setFormError(null);
          }}
          title={current.uuid ? "Edit Customer" : "Add New Customer"}
        >
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
              label="Password "
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
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
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
          title="Delete Role"
          message={`Are you sure you want to delete role ${current.name ?? ""}? This action cannot be undone.`}
        />

      </div>
    </RequirePermission>
  )
}
