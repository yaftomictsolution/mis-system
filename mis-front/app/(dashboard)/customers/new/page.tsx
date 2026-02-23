"use client";

import { useRouter } from "next/navigation";
import CustomerForm from "@/components/customers/CustomerForm";
import { customerCreate } from "@/modules/customers/customers.repo";

export default function NewCustomerPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">New Customer</h1>

      <CustomerForm
        submitLabel="Create"
        onSubmit={async (values) => {
          const row = await customerCreate(values);
          router.replace(`/customers/detail#${encodeURIComponent(row.uuid)}`);
        }}
      />
    </div>
  );
}
