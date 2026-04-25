import axios, { type AxiosError } from "axios";

export const OFFLINE_SESSION_TOKEN = "offline-token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("token");
  if (typeof token !== "string") return null;

  const normalized = token.trim();
  return normalized || null;
}

export function isOfflineSessionToken(token: string | null | undefined): boolean {
  return String(token ?? "").trim() === OFFLINE_SESSION_TOKEN;
}

export function clearPersistedAuthSession(options?: { clearOfflineCredentials?: boolean }): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  if (options?.clearOfflineCredentials) {
    localStorage.removeItem("cred_hash");
    localStorage.removeItem("offline_token");
    localStorage.removeItem("offline_user");
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  if (window.location.pathname === "/offline") return;

  const redirectTarget = `${window.location.pathname}${window.location.search}`;
  const redirectQuery = redirectTarget.startsWith("/")
    ? `?redirect=${encodeURIComponent(redirectTarget)}`
    : "";

  window.location.replace(`/login${redirectQuery}`);
}

function shouldHandleUnauthorized(error: AxiosError): boolean {
  if (error.response?.status !== 401) return false;

  const url = String(error.config?.url ?? "");
  if (url.includes("/api/auth/login")) return false;

  return true;
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const token = getStoredAuthToken();
  if (!token) return config;

  if (isOfflineSessionToken(token)) {
    if (navigator.onLine) {
      clearPersistedAuthSession();
      redirectToLogin();
    }
    return config;
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== "undefined" && shouldHandleUnauthorized(error)) {
      clearPersistedAuthSession();
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);
