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
            job_title: values.job_title,
            tazkira_number: values.tazkira_number,
            phone: values.phone_primary,
            phone1: values.phone_secondary,
            email: values.email,
            address: values.address,
            current_area: values.current_area,
            current_district: values.current_district,
            current_province: values.current_province,
            original_area: values.original_area,
            original_district: values.original_district,
            original_province: values.original_province,
            representative_name: values.representative_name,
            representative_fname: values.representative_father_name,
            representative_gname: values.representative_grandfather_name,
            representative_job_title: values.representative_job_title,
            representative_relationship: values.representative_relationship,
            representative_phone: values.representative_phone,
            representative_tazkira_number: values.representative_tazkira_number,
            representative_current_area: values.representative_current_area,
            representative_current_district: values.representative_current_district,
            representative_current_province: values.representative_current_province,
            representative_original_area: values.representative_original_area,
            representative_original_district: values.representative_original_district,
            representative_original_province: values.representative_original_province,
            customer_image_attachment: values.customer_photo_file,
            customer_representative_image_attachment: values.representative_photo_file,
            attachment: values.attachment_file,
          });
          router.replace(`/customers/detail#${encodeURIComponent(row.uuid)}`);
        }}
      />
    </div>
  );
}
