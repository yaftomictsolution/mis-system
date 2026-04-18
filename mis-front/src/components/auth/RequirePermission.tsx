"use client";

import { useSelector } from "react-redux";
import { clearPersistedAuthSession, isOfflineSessionToken } from "@/lib/api";
import { hasAnyPermission, hasAnyRole, type PermissionRequirement, type RoleRequirement } from "@/lib/permissions";
import type { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function RequirePermission({
  permission,
  role,
  children,
}: {
  permission: PermissionRequirement;
  role?: RoleRequirement;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, user, hydrated, status } = useSelector((s: RootState) => s.auth);
  const perms = useMemo(() => user?.permissions || [], [user]);
  const roles = useMemo(() => user?.roles || [], [user]);
  const hasPermissionRequirement = permission != null;
  const hasRoleRequirement = role != null;
  const allowedByPermission = useMemo(() => hasAnyPermission(perms, permission), [perms, permission]);
  const allowedByRole = useMemo(() => hasAnyRole(roles, role), [role, roles]);
  const allowed = useMemo(() => {
    if (hasPermissionRequirement && hasRoleRequirement) {
      return allowedByPermission || allowedByRole;
    }
    if (hasPermissionRequirement) {
      return allowedByPermission;
    }
    if (hasRoleRequirement) {
      return allowedByRole;
    }
    return true;
  }, [allowedByPermission, allowedByRole, hasPermissionRequirement, hasRoleRequirement]);
  const waitingForUser = Boolean(token) && !user && (status === "loading" || status === "idle");
  const onlineWithOfflineToken = useMemo(
    () => hydrated && typeof navigator !== "undefined" && navigator.onLine && isOfflineSessionToken(token),
    [hydrated, token]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (onlineWithOfflineToken) {
      clearPersistedAuthSession();
      router.replace("/login");
      return;
    }
    if (!token) {
      router.replace("/login");
      return;
    }
    if (waitingForUser) return;
    if (!allowed) router.replace("/");
  }, [allowed, hydrated, onlineWithOfflineToken, router, token, waitingForUser]);

  if (!hydrated) return null;
  if (!token) return null;
  if (onlineWithOfflineToken) return null;
  if (waitingForUser) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
