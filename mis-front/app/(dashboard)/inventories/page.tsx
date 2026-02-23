"use client";
import RequirePermission from "@/components/auth/RequirePermission";

export default function InventoryPage() {
  return (
    <RequirePermission permission="apartments.view">
      <h1 className="text-xl font-semibold">inventory</h1>
    </RequirePermission>
  );
}
