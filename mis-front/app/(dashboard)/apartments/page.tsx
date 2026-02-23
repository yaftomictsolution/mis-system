"use client";
import RequirePermission from "@/components/auth/RequirePermission";

export default function ApartmentsPage() {
  return (
    <RequirePermission permission="apartments.view">
      <h1 className="text-xl font-semibold">Apartments</h1>
    </RequirePermission>
  );
}
