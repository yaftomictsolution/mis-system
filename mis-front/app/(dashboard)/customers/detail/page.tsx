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
          phone_primary: item.phone ?? "",
          phone_secondary: item.phone1 ?? "",
          email: item.email ?? "",
          address: item.address ?? "",
        }}
        submitLabel="Update"
        onSubmit={async (values) => {
          const updated = await customerUpdate(uuid, {
            name: values.first_name,
            fname: values.father_name,
            gname: values.grandfather_name,
            phone: values.phone_primary,
            phone1: values.phone_secondary,
            email: values.email,
            address: values.address,
            attachment: values.attachment_file,
          });
          setItem(updated);
        }}
      />
    </div>
  );
}
