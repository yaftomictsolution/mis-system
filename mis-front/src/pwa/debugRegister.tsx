"use client";

import { useEffect } from "react";

export default function DebugRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('DebugRegister: serviceWorker not available in navigator');
      return;
    }

    // attempt to get existing registration first
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        console.info('DebugRegister: existing registration found', reg);
        return;
      }

      // try to register /sw.js for debugging purposes
      navigator.serviceWorker
        .register('/sw.js')
        .then((r) => {
          console.info('DebugRegister: registered /sw.js', r);
        })
        .catch((err) => {
          console.error('DebugRegister: registration failed', err);
        });
    }).catch((err) => {
      console.error('DebugRegister: getRegistration failed', err);
    });
  }, []);

  return null;
}
