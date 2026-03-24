"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell, Database, Globe, Lock, Moon, RefreshCw, Shield, Sun, User } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import OfflinePolicyPanel from "@/components/account/OfflinePolicyPanel";
import DataManagementPanel from "@/components/account/DataManagementPanel";
import { api } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  getNotificationPreferences,
  type NotificationPreferences,
  setNotificationPreferences,
} from "@/modules/notifications/notification-preferences";
import { clearOfflineCredentials, fetchMe } from "@/store/auth/authSlice";
import type { AppDispatch, RootState } from "@/store/store";
import { useTheme } from "../../context/ThemeContext";

type TabId = "profile" | "system" | "notifications" | "security" | "data";

type TabConfig = {
  id: TabId;
  label: string;
  icon: typeof User;
};

type SystemPreferences = {
  language: string;
  timezone: string;
  twoFactorEnabled: boolean;
};

const SYSTEM_PREFS_KEY = "mis_account_system_preferences_v1";

const defaultSystemPreferences: SystemPreferences = {
  language: "English",
  timezone: "Kabul (GMT+4:30)",
  twoFactorEnabled: false,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function ToggleRow({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-[#1a1a2e] last:border-b-0">
      <div>
        <div className="font-medium text-slate-900 dark:text-white">{label}</div>
        {description ? <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <div
          className={`relative h-6 w-14 rounded-full transition-colors ${
            checked
              ? "bg-emerald-500 dark:bg-emerald-500"
              : "bg-rose-400 dark:bg-rose-500/80"
          }`}
        >
          <span
            className={`absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide text-white transition-opacity ${
              checked ? "opacity-100" : "opacity-0"
            }`}
          >
            ON
          </span>
          <span
            className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide text-white transition-opacity ${
              checked ? "opacity-0" : "opacity-100"
            }`}
          >
            OFF
          </span>
          <span
            className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
              checked ? "left-[34px]" : "left-[2px]"
            }`}
          />
        </div>
      </label>
    </div>
  );
}

export default function AccountSettingsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(
    getNotificationPreferences(),
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [systemPreferences, setSystemPreferences] = useState<SystemPreferences>(defaultSystemPreferences);

  const isAdmin = (user?.roles ?? []).some((role) => String(role).trim().toLowerCase() === "admin");
  const tabs = useMemo<Array<TabConfig>>(() => {
    const baseTabs: Array<TabConfig> = [
      { id: "profile", label: "Profile", icon: User },
      { id: "system", label: "System", icon: Globe },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "security", label: "Security", icon: Lock },
    ];

    if (isAdmin) {
      baseTabs.push({ id: "data", label: "Data", icon: Database });
    }

    return baseTabs;
  }, [isAdmin]);
  const displayName = user?.full_name?.trim() || "User";
  const displayRole =
    Array.isArray(user?.roles) && user.roles.length ? String(user.roles[0] ?? "").trim() || "User" : "User";
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.email, user?.full_name, user?.phone]);

  useEffect(() => {
    setNotificationPreferencesState(getNotificationPreferences());

    try {
      const raw = localStorage.getItem(SYSTEM_PREFS_KEY);
      if (raw) {
        setSystemPreferences({
          ...defaultSystemPreferences,
          ...(JSON.parse(raw) as Partial<SystemPreferences>),
        });
      }
    } catch {
      setSystemPreferences(defaultSystemPreferences);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SYSTEM_PREFS_KEY, JSON.stringify(systemPreferences));
  }, [systemPreferences]);

  const refreshProfile = async () => {
    setRefreshing(true);
    try {
      const result = await dispatch(fetchMe());
      if (fetchMe.fulfilled.match(result)) {
        notifySuccess("Account data refreshed.");
      } else {
        notifyError(result.payload ?? "Failed to refresh account.");
      }
    } finally {
      setRefreshing(false);
    }
  };

  const clearOffline = () => {
    dispatch(clearOfflineCredentials());
    notifySuccess("Offline credentials cleared from this browser.");
  };

  const saveProfile = async () => {
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      notifyError("Full name is required.");
      return;
    }

    setSavingProfile(true);
    try {
      await api.put("/api/auth/profile", {
        full_name: normalizedName,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      await dispatch(fetchMe());
      notifySuccess("Profile updated successfully.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
          ?.message ||
        Object.values(
          (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {},
        )[0]?.[0] ||
        "Failed to update profile.";
      notifyError(String(message));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword) {
      notifyError("Current password is required.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      notifyError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      notifyError("New password confirmation does not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/api/auth/password", {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      notifySuccess("Password updated successfully.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
          ?.message ||
        Object.values(
          (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {},
        )[0]?.[0] ||
        "Failed to update password.";
      notifyError(String(message));
    } finally {
      setSavingPassword(false);
    }
  };

  const updateSystemPreference = <K extends keyof SystemPreferences>(key: K, value: SystemPreferences[K]) => {
    setSystemPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleNotificationPreferenceChange = (key: keyof NotificationPreferences, next: boolean) => {
    const updated = { ...notificationPreferences, [key]: next };
    setNotificationPreferencesState(updated);
    setNotificationPreferences(updated);

    if (key === "pushNotifications") {
      notifySuccess(next ? "In-app notifications enabled." : "In-app notifications disabled.");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title="Settings" subtitle="Manage your account and system preferences" />

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full flex-shrink-0 lg:w-72">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-[#2a2a3e]">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-lg font-bold text-white shadow-lg shadow-blue-500/20">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900 dark:text-white">{displayName}</div>
                  <div className="truncate text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {displayRole}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-l-2 px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                        : "border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#1a1a2e]"
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a] lg:p-8">
            {activeTab === "profile" ? (
              <div className="space-y-8">
                <div className="border-b border-slate-200 pb-4 dark:border-[#2a2a3e]">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Profile Information</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Update the account identity shown across the dashboard.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 text-3xl font-bold text-white shadow-lg shadow-blue-500/25">
                      {initials}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">{displayName}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{email || "No email set"}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void refreshProfile();
                    }}
                    disabled={refreshing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1a1a2e] dark:text-slate-300 dark:hover:bg-[#2a2a3e]"
                  >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Refreshing..." : "Refresh Profile"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                    <input
                      type="text"
                      value={displayRole}
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-slate-500 dark:border-[#2a2a3e] dark:bg-[#1a1a2e] dark:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void saveProfile();
                    }}
                    disabled={savingProfile}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === "system" ? (
              <div className="space-y-8">
                <div className="border-b border-slate-200 pb-4 dark:border-[#2a2a3e]">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">System Preferences</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage appearance, local preferences, and offline browser controls.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-5 dark:border-[#2a2a3e]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">Appearance</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Toggle between light and dark themes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#1a1a2e] dark:text-slate-300 dark:hover:bg-[#2a2a3e]"
                    >
                      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Language</label>
                    <select
                      value={systemPreferences.language}
                      onChange={(event) => updateSystemPreference("language", event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                    >
                      <option>English</option>
                      <option>Dari</option>
                      <option>Pashto</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</label>
                    <select
                      value={systemPreferences.timezone}
                      onChange={(event) => updateSystemPreference("timezone", event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                    >
                      <option>Kabul (GMT+4:30)</option>
                      <option>Dubai (GMT+4:00)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      void refreshProfile();
                    }}
                    disabled={refreshing}
                    className="rounded-xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a2a3e] dark:hover:bg-[#1a1a2e]"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {refreshing ? "Refreshing profile..." : "Refresh My Profile"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Reload the latest account data from the server.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={clearOffline}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-left transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
                  >
                    <div className="font-medium text-amber-800 dark:text-amber-300">Clear Offline Credentials</div>
                    <div className="mt-1 text-sm text-amber-700 dark:text-amber-200/80">
                      Remove cached login credentials from this browser.
                    </div>
                  </button>
                </div>

                {isAdmin ? <OfflinePolicyPanel isAdmin={isAdmin} /> : null}
              </div>
            ) : null}

            {activeTab === "notifications" ? (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4 dark:border-[#2a2a3e]">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Notification Settings</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage notification channels and dashboard alerts.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                    <ToggleRow
                      label="Email Notifications"
                      checked={notificationPreferences.emailNotifications}
                      onChange={(next) => handleNotificationPreferenceChange("emailNotifications", next)}
                    />
                    <ToggleRow
                      label="SMS Alerts"
                      checked={notificationPreferences.smsAlerts}
                      onChange={(next) => handleNotificationPreferenceChange("smsAlerts", next)}
                    />
                    <ToggleRow
                      label="Push Notifications"
                      checked={notificationPreferences.pushNotifications}
                      onChange={(next) => handleNotificationPreferenceChange("pushNotifications", next)}
                    />
                    <ToggleRow
                      label="Weekly Reports"
                      checked={notificationPreferences.weeklyReports}
                      onChange={(next) => handleNotificationPreferenceChange("weeklyReports", next)}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 px-4 py-4 text-sm text-slate-600 dark:border-[#2a2a3e] dark:text-slate-300">
                    The `Push Notifications` toggle controls the top-right dashboard notification bell immediately.
                    The other toggles are stored dynamically in this browser and are ready to connect to backend delivery rules later.
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "security" ? (
              <div className="space-y-8">
                <div className="border-b border-slate-200 pb-4 dark:border-[#2a2a3e]">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security Settings</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Update your password and local security preferences.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 p-5 dark:border-[#2a2a3e]">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">Change Password</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Update your account password using your current credentials.
                        </p>
                      </div>
                      <Shield className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                        <input
                          type="password"
                          value={newPasswordConfirmation}
                          onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void savePassword();
                        }}
                        disabled={savingPassword}
                        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-5 dark:border-[#2a2a3e]">
                    <ToggleRow
                      label="Two-Factor Authentication"
                      description="Store your preference locally until backend 2FA enforcement is connected."
                      checked={systemPreferences.twoFactorEnabled}
                      onChange={(next) => updateSystemPreference("twoFactorEnabled", next)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "data" && isAdmin ? <DataManagementPanel /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
