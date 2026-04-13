"use client";

import { useCallback, useEffect, useState } from "react";

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function getInstallHelpMessage(): string {
  if (typeof navigator === "undefined") {
    return "Install is available in supported browsers like Chrome or Edge.";
  }

  const userAgent = navigator.userAgent;
  if (/Edg\//i.test(userAgent)) {
    return "If the prompt does not appear, use Edge menu > Apps > Install this site as an app.";
  }
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent) && !/OPR\//i.test(userAgent)) {
    return "If the prompt does not appear, use Chrome menu > Install MIS.";
  }
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return "If the prompt does not appear, use Share > Add to Home Screen.";
  }

  return "This browser may not fully support app install prompts. Chrome or Edge gives the best result.";
}

function canShowInstallEntry(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent;
  const isDesktopChromium =
    /Edg\//i.test(userAgent) ||
    (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent) && !/OPR\//i.test(userAgent));
  const isSafari = /Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent);

  return isDesktopChromium || isSafari;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );

  return displayModeStandalone || iosStandalone;
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;

    const updateInstalledState = () => {
      setIsInstalled(isStandaloneDisplay());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setDeferredPrompt(installEvent);
      updateInstalledState();
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstalling(false);
    };

    updateInstalledState();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleInstalled);

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateInstalledState);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(updateInstalledState);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleInstalled);

      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", updateInstalledState);
        } else if (typeof mediaQuery.removeListener === "function") {
          mediaQuery.removeListener(updateInstalledState);
        }
      }
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt || isInstalled) return "unavailable";

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice?.outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      return "unavailable";
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, isInstalled]);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    showInstallEntry: canShowInstallEntry() && !isInstalled,
    install,
    installHelpMessage: getInstallHelpMessage(),
    installing,
    isInstalled,
  };
}
