"use client";

import { useState } from "react";

type CustomerFormValues = {

  first_name: string;
  father_name: string;
  grandfather_name: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  address: string;
};

type CustomerSubmitValues = {
  
  first_name: string;
  father_name: string | null;
  grandfather_name: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
};

type Props = {
  initial?: Partial<CustomerFormValues> | null;
  onSubmit: (values: CustomerSubmitValues) => Promise<void>;
  submitLabel?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function CustomerForm({ initial, onSubmit, submitLabel = "Save" }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormValues>({
    first_name: initial?.first_name ?? "",
    father_name: initial?.father_name ?? "",
    grandfather_name: initial?.grandfather_name ?? "",
    phone_primary: initial?.phone_primary ?? "",
    phone_secondary: initial?.phone_secondary ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
  });

  function validateForm(): string | null {
    const firstName = form.first_name.trim();
    const primaryPhone = form.phone_primary.trim();
    const email = form.email.trim();

    if (!firstName) return "First name is required.";
    if (!primaryPhone) return "Primary phone is required.";
    if (firstName.length > 255) return "First name is too long.";
    if (primaryPhone.length > 50) return "Primary phone is too long.";
    if (email && !EMAIL_REGEX.test(email)) return "Email format is invalid.";

    return null;
  }

  async function submit() {
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        first_name: form.first_name.trim(),
        father_name: trimOrNull(form.father_name),
        grandfather_name: trimOrNull(form.grandfather_name),
        phone_primary: form.phone_primary.trim(),
        phone_secondary: trimOrNull(form.phone_secondary),
        email: trimOrNull(form.email)?.toLowerCase() ?? null,
        address: trimOrNull(form.address),
      });
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="First Name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
        <Input label="Phone Primary" value={form.phone_primary} onChange={(v) => setForm({ ...form, phone_primary: v })} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="Father Name" value={form.father_name} onChange={(v) => setForm({ ...form, father_name: v })} />
        <Input
          label="Grandfather Name"
          value={form.grandfather_name}
          onChange={(v) => setForm({ ...form, grandfather_name: v })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Phone Secondary"
          value={form.phone_secondary}
          onChange={(v) => setForm({ ...form, phone_secondary: v })}
        />
        <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      </div>

      <label className="block space-y-1">
        <div className="text-xs text-gray-500">Address</div>
        <textarea
          className="w-full rounded-xl border p-2"
          rows={3}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </label>

      <button
        onClick={submit}
        disabled={saving}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel} (works offline)
      </button>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      <input className="w-full rounded-xl border p-2" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
