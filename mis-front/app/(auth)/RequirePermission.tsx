"use client";

import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const perms: string[] = useSelector((s: RootState) => s.auth.user?.permissions || []);

  useEffect(() => {
    if (!perms.includes(permission)) router.replace("/");
  }, [perms, permission, router]);

  if (!perms.includes(permission)) return null;
  return <>{children}</>;
}
