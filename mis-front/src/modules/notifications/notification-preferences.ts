"use client";

import { emitAppEvent } from "@/lib/appEvents";

export type NotificationPreferences = {
  emailNotifications: boolean;
  smsAlerts: boolean;
  pushNotifications: boolean;
  weeklyReports: boolean;
};

const STORAGE_KEY = "mis_notification_preferences_v1";
const CHANGE_EVENT = "notifications:preferences-changed";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  smsAlerts: true,
  pushNotifications: true,
  weeklyReports: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      emailNotifications:
        typeof parsed.emailNotifications === "boolean"
          ? parsed.emailNotifications
          : DEFAULT_PREFERENCES.emailNotifications,
      smsAlerts: typeof parsed.smsAlerts === "boolean" ? parsed.smsAlerts : DEFAULT_PREFERENCES.smsAlerts,
      pushNotifications:
        typeof parsed.pushNotifications === "boolean"
          ? parsed.pushNotifications
          : DEFAULT_PREFERENCES.pushNotifications,
      weeklyReports:
        typeof parsed.weeklyReports === "boolean" ? parsed.weeklyReports : DEFAULT_PREFERENCES.weeklyReports,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setNotificationPreferences(next: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitAppEvent(CHANGE_EVENT, next as Record<string, unknown>);
}

export const notificationPreferencesEvent = CHANGE_EVENT;
