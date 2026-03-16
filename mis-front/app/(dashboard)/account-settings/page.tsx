"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PageHeader } from "@/components/ui/PageHeader";
import OfflinePolicyPanel from "@/components/account/OfflinePolicyPanel";
import type { AppDispatch, RootState } from "@/store/store";
import { clearOfflineCredentials, fetchMe } from "@/store/auth/authSlice";
import { api } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

export default function AccountSettingsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = (user?.roles ?? []).some((role) => String(role).trim().toLowerCase() === "admin");
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");

  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.email, user?.full_name, user?.phone]);

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
          (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {}
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
          (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {}
        )[0]?.[0] ||
        "Failed to update password.";
      notifyError(String(message));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8 space-y-6">
      <PageHeader title="Account Settings" subtitle="Manage your session and local account settings" />

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Profile Details</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-slate-500">Full Name</p>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Email</p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Phone</p>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void saveProfile();
              }}
              disabled={savingProfile}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Change Password</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-slate-500">Current Password</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">New Password</p>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Confirm New Password</p>
            <input
              type="password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void savePassword();
              }}
              disabled={savingPassword}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Other Actions</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void refreshProfile();
            }}
            disabled={refreshing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh My Profile"}
          </button>

          <button
            type="button"
            onClick={clearOffline}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          >
            Clear Offline Credentials
          </button>
        </div>
      </div>

      <OfflinePolicyPanel isAdmin={isAdmin} />
    </div>
  );
}
