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
          const row = await customerCreate({
            name: values.first_name,
            fname: values.father_name,
            gname: values.grandfather_name,
            phone: values.phone_primary,
            phone1: values.phone_secondary,
            email: values.email,
            address: values.address,
            attachment: values.attachment_file,
          });
          router.replace(`/customers/detail#${encodeURIComponent(row.uuid)}`);
        }}
      />
    </div>
  );
}
