"use client";

import { Provider } from "react-redux";
import { store } from "@/store/store";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hydrateAuth } from "@/store/auth/authSlice";
import { ThemeProvider } from './context/ThemeContext'
import CacheOnVisit from '@/pwa/CacheOnVisit';
import DebugRegister from '@/pwa/debugRegister';
import ToastHost from "@/components/ui/ToastHost";
import { ensureCacheSchemaCompatibility } from "@/sync/cacheSchema";
import { seedDefaultData } from "@/lib/seedData";

function Bootstrap() {
  useEffect(() => {
    void ensureCacheSchemaCompatibility();
    void seedDefaultData();

    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    let user = null;

    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {
        user = null;
      }
    }

    store.dispatch(
      hydrateAuth({
        token: token || null,
        user,
      })
    );
  }, []);

  return null;
}

function GlobalAppEnhancers() {
  const pathname = usePathname();
  const isPrintRoute = pathname.startsWith("/print/");

  if (isPrintRoute) {
    return null;
  }

  return (
    <>
      <DebugRegister />
      <CacheOnVisit />
      <Bootstrap />
      <ToastHost />
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <GlobalAppEnhancers />
        {children}
      </ThemeProvider>
    </Provider>
  );
}
