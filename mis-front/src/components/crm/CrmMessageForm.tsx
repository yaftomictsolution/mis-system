"use client";

import { FormField } from "@/components/ui/FormField";

export type CrmFormData = {
  customer_id: string;
  channel: "email" | "sms";
  message_type: string;
};

type CustomerOption = {
  id: number;
  label: string;
};

type Props = {
  value: CrmFormData;
  customers: CustomerOption[];
  saving: boolean;
  onChange: (next: CrmFormData) => void;
  onSubmit: () => void;
};

export function CrmMessageForm({ value, customers, saving, onChange, onSubmit }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField
          label="Customer"
          type="select"
          value={value.customer_id}
          onChange={(next) => onChange({ ...value, customer_id: String(next) })}
          options={[
            { value: "", label: "Select customer" },
            ...customers.map((item) => ({ value: String(item.id), label: item.label })),
          ]}
          required
        />
        <FormField
          label="Channel"
          type="select"
          value={value.channel}
          onChange={(next) => onChange({ ...value, channel: String(next) === "sms" ? "sms" : "email" })}
          options={[
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
          ]}
          required
        />
        <FormField
          label="Message Type"
          value={value.message_type}
          onChange={(next) => onChange({ ...value, message_type: String(next) })}
          required
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Sending..." : "Send Message"}
        </button>
      </div>
    </div>
  );
}

