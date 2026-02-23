"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import { fetchMe } from "@/store/auth/authSlice";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { token, user, hydrated, status } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      router.replace("/login");
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
