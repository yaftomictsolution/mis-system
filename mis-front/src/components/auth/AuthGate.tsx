"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clearPersistedAuthSession, isOfflineSessionToken } from "@/lib/api";
import { isOfflineAccessExpired, isOfflineSystemBlocked } from "@/modules/offline-policy/offline-policy.repo";
import type { AppDispatch, RootState } from "@/store/store";
import { fetchMe } from "@/store/auth/authSlice";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { token, user, hydrated, status } = useSelector((s: RootState) => s.auth);
  const refreshedUserRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;

    if (typeof navigator !== "undefined" && !navigator.onLine && (isOfflineSystemBlocked() || isOfflineAccessExpired())) {
      router.replace("/login");
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine && isOfflineSessionToken(token)) {
      clearPersistedAuthSession();
      router.replace("/login");
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    if (Number(user?.customer_id ?? 0) > 0) {
      router.replace("/customer-portal");
      return;
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.onLine &&
      token &&
      !isOfflineSessionToken(token) &&
      status !== "loading" &&
      !refreshedUserRef.current
    ) {
      refreshedUserRef.current = true;
      void dispatch(fetchMe());
      return;
    }

    if (!user && status !== "loading") {
      void dispatch(fetchMe());
    }
  }, [hydrated, token, user, status, dispatch, router]);

  if (!hydrated) return null;
  if (!token) return null;

  return <>{children}</>;
}
