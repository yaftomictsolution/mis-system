"use client";

import { useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";

export type CustomerFormValues = {
  first_name: string;
  father_name: string;
  grandfather_name: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  address: string;
  attachment_file: File | null;
};

type CustomerFormProps = {
  initial?: Partial<CustomerFormValues>;
  submitLabel?: string;
  onSubmit: (values: CustomerFormValues) => Promise<void> | void;
};

const DEFAULT_VALUES: CustomerFormValues = {
  first_name: "",
  father_name: "",
  grandfather_name: "",
  phone_primary: "",
  phone_secondary: "",
  email: "",
  address: "",
  attachment_file: null,
};

export default function CustomerForm({ initial, submitLabel = "Save", onSubmit }: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>({
    ...DEFAULT_VALUES,
    ...initial,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => values.first_name.trim().length > 0 && values.phone_primary.trim().length > 0,
    [values.first_name, values.phone_primary],
  );

  const setField = (key: keyof CustomerFormValues, value: string | number | File | null) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!canSubmit) {
      setError("Full name and primary phone are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        first_name: values.first_name.trim(),
        father_name: values.father_name.trim(),
        grandfather_name: values.grandfather_name.trim(),
        phone_primary: values.phone_primary.trim(),
        phone_secondary: values.phone_secondary.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        attachment_file: values.attachment_file,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save customer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Full Name"
          value={values.first_name}
          onChange={(value) => setField("first_name", value)}
          required
        />
        <FormField
          label="Phone Number"
          value={values.phone_primary}
          onChange={(value) => setField("phone_primary", value)}
          required
        />
        <FormField
          label="Father Name"
          value={values.father_name}
          onChange={(value) => setField("father_name", value)}
        />
        <FormField
          label="Grandfather Name"
          value={values.grandfather_name}
          onChange={(value) => setField("grandfather_name", value)}
        />
        <FormField
          label="Second Number"
          value={values.phone_secondary}
          onChange={(value) => setField("phone_secondary", value)}
        />
        <FormField
          label="Email Address"
          type="email"
          value={values.email}
          onChange={(value) => setField("email", value)}
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachment</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setField("attachment_file", file);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          />
          {values.attachment_file && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{values.attachment_file.name}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <FormField
            label="Address"
            type="textarea"
            value={values.address}
            onChange={(value) => setField("address", value)}
            rows={3}
          />
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void handleSubmit();
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
