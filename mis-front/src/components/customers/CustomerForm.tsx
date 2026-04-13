"use client";

import { useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";

export type CustomerFormValues = {
  first_name: string;
  father_name: string;
  grandfather_name: string;
  job_title: string;
  tazkira_number: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  address: string;
  current_area: string;
  current_district: string;
  current_province: string;
  original_area: string;
  original_district: string;
  original_province: string;
  representative_name: string;
  representative_father_name: string;
  representative_grandfather_name: string;
  representative_job_title: string;
  representative_relationship: string;
  representative_phone: string;
  representative_tazkira_number: string;
  representative_current_area: string;
  representative_current_district: string;
  representative_current_province: string;
  representative_original_area: string;
  representative_original_district: string;
  representative_original_province: string;
  customer_photo_file: File | null;
  representative_photo_file: File | null;
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
  job_title: "",
  tazkira_number: "",
  phone_primary: "",
  phone_secondary: "",
  email: "",
  address: "",
  current_area: "",
  current_district: "",
  current_province: "",
  original_area: "",
  original_district: "",
  original_province: "",
  representative_name: "",
  representative_father_name: "",
  representative_grandfather_name: "",
  representative_job_title: "",
  representative_relationship: "",
  representative_phone: "",
  representative_tazkira_number: "",
  representative_current_area: "",
  representative_current_district: "",
  representative_current_province: "",
  representative_original_area: "",
  representative_original_district: "",
  representative_original_province: "",
  customer_photo_file: null,
  representative_photo_file: null,
  attachment_file: null,
};

function UploadField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
      />
      {file && <p className="text-xs text-slate-500 dark:text-slate-400">{file.name}</p>}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="md:col-span-2">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

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
        ...values,
        first_name: values.first_name.trim(),
        father_name: values.father_name.trim(),
        grandfather_name: values.grandfather_name.trim(),
        job_title: values.job_title.trim(),
        tazkira_number: values.tazkira_number.trim(),
        phone_primary: values.phone_primary.trim(),
        phone_secondary: values.phone_secondary.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        current_area: values.current_area.trim(),
        current_district: values.current_district.trim(),
        current_province: values.current_province.trim(),
        original_area: values.original_area.trim(),
        original_district: values.original_district.trim(),
        original_province: values.original_province.trim(),
        representative_name: values.representative_name.trim(),
        representative_father_name: values.representative_father_name.trim(),
        representative_grandfather_name: values.representative_grandfather_name.trim(),
        representative_job_title: values.representative_job_title.trim(),
        representative_relationship: values.representative_relationship.trim(),
        representative_phone: values.representative_phone.trim(),
        representative_tazkira_number: values.representative_tazkira_number.trim(),
        representative_current_area: values.representative_current_area.trim(),
        representative_current_district: values.representative_current_district.trim(),
        representative_current_province: values.representative_current_province.trim(),
        representative_original_area: values.representative_original_area.trim(),
        representative_original_district: values.representative_original_district.trim(),
        representative_original_province: values.representative_original_province.trim(),
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
        <SectionTitle
          title="Buyer Identity"
          subtitle="These fields are used directly in the deed print layout."
        />
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
          label="Job Title"
          value={values.job_title}
          onChange={(value) => setField("job_title", value)}
        />
        <FormField
          label="Tazkira Number"
          value={values.tazkira_number}
          onChange={(value) => setField("tazkira_number", value)}
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
        <div className="md:col-span-2">
          <FormField
            label="General Address / Notes"
            type="textarea"
            value={values.address}
            onChange={(value) => setField("address", value)}
            rows={2}
          />
        </div>

        <SectionTitle title="Buyer Current Residence" />
        <FormField
          label="Village / Nahia"
          value={values.current_area}
          onChange={(value) => setField("current_area", value)}
        />
        <FormField
          label="District / Wolaswali"
          value={values.current_district}
          onChange={(value) => setField("current_district", value)}
        />
        <div className="md:col-span-2">
          <FormField
            label="Province / Wilayat"
            value={values.current_province}
            onChange={(value) => setField("current_province", value)}
          />
        </div>

        <SectionTitle title="Buyer Original Residence" />
        <FormField
          label="Village / Nahia"
          value={values.original_area}
          onChange={(value) => setField("original_area", value)}
        />
        <FormField
          label="District / Wolaswali"
          value={values.original_district}
          onChange={(value) => setField("original_district", value)}
        />
        <div className="md:col-span-2">
          <FormField
            label="Province / Wilayat"
            value={values.original_province}
            onChange={(value) => setField("original_province", value)}
          />
        </div>

        <SectionTitle
          title="Buyer Representative"
          subtitle="Fill this when the deed should print the customer’s wakil / representative details."
        />
        <FormField
          label="Representative Name"
          value={values.representative_name}
          onChange={(value) => setField("representative_name", value)}
        />
        <FormField
          label="Representative Phone"
          value={values.representative_phone}
          onChange={(value) => setField("representative_phone", value)}
        />
        <FormField
          label="Father Name"
          value={values.representative_father_name}
          onChange={(value) => setField("representative_father_name", value)}
        />
        <FormField
          label="Grandfather Name"
          value={values.representative_grandfather_name}
          onChange={(value) => setField("representative_grandfather_name", value)}
        />
        <FormField
          label="Job Title"
          value={values.representative_job_title}
          onChange={(value) => setField("representative_job_title", value)}
        />
        <FormField
          label="Relationship To Buyer"
          value={values.representative_relationship}
          onChange={(value) => setField("representative_relationship", value)}
        />
        <FormField
          label="Tazkira Number"
          value={values.representative_tazkira_number}
          onChange={(value) => setField("representative_tazkira_number", value)}
        />

        <SectionTitle title="Representative Current Residence" />
        <FormField
          label="Village / Nahia"
          value={values.representative_current_area}
          onChange={(value) => setField("representative_current_area", value)}
        />
        <FormField
          label="District / Wolaswali"
          value={values.representative_current_district}
          onChange={(value) => setField("representative_current_district", value)}
        />
        <div className="md:col-span-2">
          <FormField
            label="Province / Wilayat"
            value={values.representative_current_province}
            onChange={(value) => setField("representative_current_province", value)}
          />
        </div>

        <SectionTitle title="Representative Original Residence" />
        <FormField
          label="Village / Nahia"
          value={values.representative_original_area}
          onChange={(value) => setField("representative_original_area", value)}
        />
        <FormField
          label="District / Wolaswali"
          value={values.representative_original_district}
          onChange={(value) => setField("representative_original_district", value)}
        />
        <div className="md:col-span-2">
          <FormField
            label="Province / Wilayat"
            value={values.representative_original_province}
            onChange={(value) => setField("representative_original_province", value)}
          />
        </div>

        <SectionTitle
          title="Deed Photos"
          subtitle="These two images are attached as customer documents and used in the deed print."
        />
        <UploadField
          label="Buyer Photo"
          file={values.customer_photo_file}
          onChange={(file) => setField("customer_photo_file", file)}
        />
        <UploadField
          label="Representative Photo"
          file={values.representative_photo_file}
          onChange={(file) => setField("representative_photo_file", file)}
        />
        <div className="md:col-span-2">
          <UploadField
            label="General Attachment"
            file={values.attachment_file}
            onChange={(file) => setField("attachment_file", file)}
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
