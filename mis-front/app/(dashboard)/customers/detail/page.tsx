"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CustomerForm from "@/components/customers/CustomerForm";
import type { CustomerRow } from "@/db/localDB";
import { customerDelete, customerGetLocal, customerUpdate, customersPullToLocal } from "@/modules/customers/customers.repo";

function readUuidFromHash(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) return "";
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export default function CustomerDetailsOfflineCapablePage() {
  const router = useRouter();
  const [uuid, setUuid] = useState("");
  const [item, setItem] = useState<CustomerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateFromHash = () => setUuid(readUuidFromHash());
    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
    return () => window.removeEventListener("hashchange", updateFromHash);
  }, []);

  useEffect(() => {
    (async () => {
      if (!uuid) {
        setItem(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const localRow = await customerGetLocal(uuid);
      if (localRow) {
        setItem(localRow);
        setLoading(false);
        return;
      }

      try {
        await customersPullToLocal();
      } catch {}

      const pulledRow = await customerGetLocal(uuid);
      setItem(pulledRow ?? null);
      setLoading(false);
    })();
  }, [uuid]);

  useEffect(() => {
    const onSyncComplete = async () => {
      if (!uuid) return;
      const refreshed = await customerGetLocal(uuid);
      setItem(refreshed ?? null);
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [uuid]);

  if (!uuid) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600">Missing customer id.</div>
        <Link href="/customers" className="inline-block rounded-xl border bg-white px-3 py-2 text-sm">
          Back to Customers
        </Link>
      </div>
    );
  }

  if (loading) return <div className="text-sm text-gray-600">Loading...</div>;
  if (!item) return <div className="text-sm text-gray-600">Customer not found locally.</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <div className="flex gap-2">
          <Link href="/customers" className="rounded-xl border bg-white px-3 py-2 text-sm">
            Back
          </Link>
          <button
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            onClick={async () => {
              if (!confirm("Delete this customer?")) return;
              await customerDelete(uuid);
              router.replace("/customers");
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <CustomerForm
        initial={{
          first_name: item.name ?? "",
          father_name: item.fname ?? "",
          grandfather_name: item.gname ?? "",
          job_title: item.job_title ?? "",
          tazkira_number: item.tazkira_number ?? "",
          phone_primary: item.phone ?? "",
          phone_secondary: item.phone1 ?? "",
          email: item.email ?? "",
          address: item.address ?? "",
          current_area: item.current_area ?? "",
          current_district: item.current_district ?? "",
          current_province: item.current_province ?? "",
          original_area: item.original_area ?? "",
          original_district: item.original_district ?? "",
          original_province: item.original_province ?? "",
          representative_name: item.representative_name ?? "",
          representative_father_name: item.representative_fname ?? "",
          representative_grandfather_name: item.representative_gname ?? "",
          representative_job_title: item.representative_job_title ?? "",
          representative_relationship: item.representative_relationship ?? "",
          representative_phone: item.representative_phone ?? "",
          representative_tazkira_number: item.representative_tazkira_number ?? "",
          representative_current_area: item.representative_current_area ?? "",
          representative_current_district: item.representative_current_district ?? "",
          representative_current_province: item.representative_current_province ?? "",
          representative_original_area: item.representative_original_area ?? "",
          representative_original_district: item.representative_original_district ?? "",
          representative_original_province: item.representative_original_province ?? "",
        }}
        submitLabel="Update"
        onSubmit={async (values) => {
          const updated = await customerUpdate(uuid, {
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
          setItem(updated);
        }}
      />
    </div>
  );
}
