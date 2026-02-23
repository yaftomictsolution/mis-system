"use client";

import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, user, hydrated, status } = useSelector((s: RootState) => s.auth);
  const perms = useMemo(() => user?.permissions || [], [user]);
  const waitingForUser = Boolean(token) && !user && (status === "loading" || status === "idle");

  useEffect(() => {
    if (!hydrated) return;
    if (waitingForUser) return;
    if (!perms.includes(permission)) router.replace("/");
  }, [hydrated, waitingForUser, perms, permission, router]);

  if (!hydrated) return null;
  if (waitingForUser) return null;
  if (!perms.includes(permission)) return null;
  return <>{children}</>;
}
