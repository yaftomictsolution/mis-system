"use client";
import RequirePermission from "@/components/auth/RequirePermission";

export default function EmployeePage() {
  return (
    <RequirePermission permission="apartments.view">
      <h1 className="text-xl font-semibold">Installments</h1>
    </RequirePermission>
  );
}
