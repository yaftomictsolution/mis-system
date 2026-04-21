"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import RequireAdmin from "@/components/auth/RequireAdmin";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/FormField";
import { RoleRow } from "@/db/localDB";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  userRoleCreate,
  UserRoleListLocal,
  userRolePermissionOptions,
  userRolePullToLocal,
  userRoleUpdate,
  userRoleDelete,
} from "@/modules/userRoles/userRoles.repo";


const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;
const PERMISSION_PREVIEW_LIMIT = 3;


export default function UserRolesPage() {
  const [data, setData] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionOptions, setPermissionOptions] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<RoleRow>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [permissionPreview, setPermissionPreview] = useState<{
    roleName: string;
    permissions: string[];
  } | null>(null);
  
  const loadLocal = useCallback(async () => {
    const local = await UserRoleListLocal({
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
          await userRolePullToLocal();
        } catch {}
        await loadLocal();
      } finally {
        setLoading(false);
      }
    }, [loadLocal]);

  const loadPermissionOptions = useCallback(async () => {
    const options = await userRolePermissionOptions();
    setPermissionOptions(options);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadPermissionOptions();
  }, [loadPermissionOptions]);

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
      setFormError("Role name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      const permissions = Array.from(
        (current.permissions ?? []).reduce((map, value) => {
          const original = String(value).trim();
          if (!original) return map;
          const key = original.toLowerCase();
          if (!map.has(key)) {
            map.set(key, original);
          }
          return map;
        }, new Map<string, string>()).values(),
      );
      const payload = {
        name,
        permissions,
      };
      if (current.uuid) {
        await userRoleUpdate(current.uuid, payload);
      } else {
        await userRoleCreate(payload);
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

  const togglePermission = useCallback((permission: string) => {
    setCurrent((prev) => {
      const selected = new Set(prev.permissions ?? []);
      if (selected.has(permission)) {
        selected.delete(permission);
      } else {
        selected.add(permission);
      }
      return {
        ...prev,
        permissions: Array.from(selected).sort(),
      };
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!current.uuid) return;
    try {
      await userRoleDelete(current.uuid);
      setIsDeleteOpen(false);
      setCurrent({});
      await refresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [current.uuid, refresh]);

  const columns = useMemo<Column<RoleRow>[]>(
    () => [
      {
        key: "name",
        label: "Role",
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
              </div>
            </div>
          );
        },
      },
      {
        key: "permissions",
        label: "Permissions",
        render: (item) => {
          const names = item.permissions ?? [];
          if (!names.length) return <span className="text-slate-400">-</span>;
          const visiblePermissions = names.slice(0, PERMISSION_PREVIEW_LIMIT);
          const remainingCount = Math.max(0, names.length - visiblePermissions.length);
          return (
            <div className="space-y-2">
              <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                {visiblePermissions.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex min-w-0 flex-1 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-[#1a1a2e] dark:text-slate-300"
                    title={permission}
                  >
                    <span className="truncate">{permission}</span>
                  </span>
                ))}
                {remainingCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPermissionPreview({
                        roleName: item.name,
                        permissions: names,
                      })
                    }
                    className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    +{remainingCount} more
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400" title={names.join(", ")}>
                {names.length} permission{names.length === 1 ? "" : "s"}
              </div>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <RequireAdmin>
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <PageHeader title="User Roles" subtitle="Create role and assign permissions">
          <button
            type="button"
            onClick={() => {
              setCurrent({ name: "", permissions: [] });
              setFormError(null);
              void loadPermissionOptions();
              setIsModalOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 sm:w-auto"
          >
            <Plus size={18} /> Add Role
          </button>
        </PageHeader>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          onEdit={(item) => {
            setFormError(null);
            setCurrent({
              ...item,
              permissions: item.permissions ?? [],
            });
            void loadPermissionOptions();
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            setCurrent(item);
            setIsDeleteOpen(true);
          }}
          searchKeys={["name", "permissions"]}
          pageSize={TABLE_PAGE_SIZE}
          mobileStack
          noHorizontalScroll
        />

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setFormError(null);
          }}
          title={current.uuid ? "Edit Role Permissions" : "Add New Role"}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Role Name"
              value={current.name ?? ""}
              onChange={(val) => setCurrent({ ...current, name: String(val) })}
              required
            />
            <div className="col-span-2 space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Permissions
              </label>
              <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
                {permissionOptions.length === 0 && (
                  <div className="text-sm text-slate-500">No permission options found.</div>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {permissionOptions.map((permission) => {
                    const checked = (current.permissions ?? []).includes(permission);
                    return (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-[#1a1a2e]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(permission)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{permission}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {formError && <div className="mt-4 text-sm text-red-600">{formError}</div>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
              }}
              className="rounded-lg px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a1a2e]">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Role"}
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

        <Modal
          isOpen={Boolean(permissionPreview)}
          onClose={() => setPermissionPreview(null)}
          title={permissionPreview ? `${permissionPreview.roleName} Permissions` : "Permissions"}
        >
          <div className="space-y-4">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {permissionPreview?.permissions.length ?? 0} permission
              {(permissionPreview?.permissions.length ?? 0) === 1 ? "" : "s"} assigned
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(permissionPreview?.permissions ?? []).map((permission) => (
                  <div
                    key={permission}
                    className="rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-[#12121a] dark:text-slate-300"
                  >
                    {permission}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPermissionPreview(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </RequireAdmin>
  );
}
