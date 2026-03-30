"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { isAdminRole } from "@/lib/permissions";
import type { RootState } from "@/store/store";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, hydrated, status } = useSelector((s: RootState) => s.auth);
  const roles = useMemo(() => user?.roles ?? [], [user]);
  const allowed = useMemo(() => isAdminRole(roles), [roles]);
  const waitingForUser = Boolean(token) && !user && (status === "loading" || status === "idle");

  useEffect(() => {
    if (!hydrated) return;
    if (waitingForUser) return;
    if (!allowed) router.replace("/");
  }, [allowed, hydrated, waitingForUser, router]);

  if (!hydrated) return null;
  if (waitingForUser) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
