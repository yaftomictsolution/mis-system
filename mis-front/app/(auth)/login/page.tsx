"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import { login, hydrateAuth } from "@/store/auth/authSlice";
import { computeCredHash } from "@/lib/crypto";
import { isOfflineAccessExpired, isOfflineSystemBlocked } from "@/modules/offline-policy/offline-policy.repo";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

function normalizeRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { status, error } = useSelector((s: RootState) => s.auth);
  const redirectTarget = normalizeRedirectPath(searchParams.get("redirect"));

  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);

  const rejectLogin = (message: string) => {
    dispatch({ type: "auth/login/rejected", payload: message });
  };

  const saveSession = (token: string, user: unknown) => {
    try {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    } catch {}
    dispatch(hydrateAuth({ token, user: user as RootState["auth"]["user"] }));
  };

  const resolveDefaultRoute = (user: RootState["auth"]["user"] | null): string => {
    if (redirectTarget) return redirectTarget;
    if (Number(user?.customer_id ?? 0) > 0) return "/customer-portal";
    return "/";
  };

  const redirectAfterLogin = async (user: RootState["auth"]["user"] | null) => {
    const target = resolveDefaultRoute(user);
    if (navigator.onLine) {
      router.replace(target);
      return;
    }

    try {
      const hasTarget = await caches.match(target);
      if (hasTarget) {
        router.replace(target);
        return;
      }
      const hasRoot = await caches.match("/");
      router.replace(hasRoot ? "/" : "/offline");
    } catch {
      router.replace("/offline");
    }
  };

  const tryOfflineLogin = async (): Promise<boolean> => {
    if (isOfflineSystemBlocked() || isOfflineAccessExpired()) {
      rejectLogin("Offline access expired. Internet connection is required.");
      return false;
    }

    const storedHash = localStorage.getItem("cred_hash");
    if (!storedHash) {
      rejectLogin("No offline credentials stored");
      return false;
    }

    try {
      const currentHash = await computeCredHash(email, password);
      if (currentHash !== storedHash) {
        rejectLogin("Offline login failed");
        return false;
      }

      const storedToken = localStorage.getItem("token") || localStorage.getItem("offline_token");
      const storedUserRaw = localStorage.getItem("user") || localStorage.getItem("offline_user");

      if (!storedToken && !storedUserRaw) {
        rejectLogin("Offline login failed");
        return false;
      }

      const tokenToUse = storedToken || "offline-token";
      let userToUse: unknown = { id: null, full_name: null, email, roles: [], permissions: [] };

      if (storedUserRaw) {
        try {
          userToUse = JSON.parse(storedUserRaw) as unknown;
        } catch {
          userToUse = { id: null, full_name: null, email, roles: [], permissions: [] };
        }
      }

      saveSession(tokenToUse, userToUse);
      await redirectAfterLogin(userToUse as RootState["auth"]["user"]);
      return true;
    } catch {
      rejectLogin("Offline login failed");
      return false;
    }
  };

  const tryOnlineLogin = async (): Promise<boolean> => {
    try {
      const result = await dispatch(login({ email, password }));
      if (!login.fulfilled.match(result)) return false;
      router.replace(resolveDefaultRoute(result.payload.user));
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!navigator.onLine) {
      await tryOfflineLogin();
      return;
    }

    const onlineOk = await tryOnlineLogin();
    if (!onlineOk) {
      await tryOfflineLogin();
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-slate-100 dark:bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.15),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.16),transparent_32%)]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-[#12121a] border border-slate-200 dark:border-[#2a2a3e] rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">MIS Front</p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sign in</h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#1a1a2e] h-11 pl-10 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Password</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#1a1a2e] h-11 pl-10 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <input type="checkbox" className="rounded border-slate-300 dark:border-[#2a2a3e]" />
                Remember me
              </label>
              <button type="button" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                Forgot password
              </button>
            </div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Signing in..." : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-[#0a0a0f]">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">
            Loading login...
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
