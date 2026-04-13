"use client";

import type { ApartmentRow } from "@/db/localDB";
import { Badge } from "@/components/ui/Badge";
import { buildQrAccessPath } from "@/lib/secureQr";

type Props = {
  row: ApartmentRow;
  onViewQr?: (row: ApartmentRow) => void;
};

const statusColor: Record<string, "blue" | "purple" | "amber" | "emerald"> = {
  available: "emerald",
  reserved: "amber",
  handed_over: "blue",
  sold: "purple",
  rented: "blue",
  company_use: "amber",
};

function normalizeStatus(status: string): string {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "company_use") return "company use";
  if (value === "handed_over") return "handed over";
  return value || "available";
}

function normalizeUsage(usage: string): string {
  return String(usage ?? "").trim().toLowerCase() === "commercial" ? "commercial" : "residential";
}

function valueOrDash(value: string | number | null | undefined): string {
  const text = String(value ?? "").trim();
  return text ? text : "-";
}

export default function ApartmentExpandedRow({ row, onViewQr }: Props) {
  const normalizedStatus = normalizeStatus(row.status);
  const normalizedUsage = normalizeUsage(row.usage_type);
  const qrToken = String(row.qr_access_token ?? "").trim();
  const qrStatus = String(row.qr_access_status ?? "").trim() || "Not ready";

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Apartment Details</div>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{row.apartment_code}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Block: ${valueOrDash(row.block_number)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Unit: ${valueOrDash(row.unit_number)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Floor: ${valueOrDash(row.floor_number)}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Layout & Size</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{`Bedrooms: ${row.bedrooms ?? 0}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Halls: ${row.halls ?? 0}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Bathrooms: ${row.bathrooms ?? 0}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Kitchens: ${row.kitchens ?? 0}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Area: ${valueOrDash(row.area_sqm)} sqm`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Balcony: ${row.balcony ? "Yes" : "No"}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Property Info</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={normalizedUsage === "residential" ? "blue" : "purple"}>{normalizedUsage}</Badge>
            <Badge color={statusColor[normalizedStatus.replaceAll(" ", "_")] ?? "emerald"}>{normalizedStatus}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{`Shape: ${valueOrDash(row.apartment_shape)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Corridor: ${valueOrDash(row.corridor)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Price: ${
            typeof row.total_price === "number" && Number.isFinite(row.total_price) ? `$${row.total_price.toFixed(2)}` : "-"
          }`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`QR Status: ${qrStatus}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">QR & Boundaries</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{`North: ${valueOrDash(row.north_boundary)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`South: ${valueOrDash(row.south_boundary)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`East: ${valueOrDash(row.east_boundary)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`West: ${valueOrDash(row.west_boundary)}`}</p>

          {qrToken ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onViewQr?.(row)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                View QR
              </button>
              <button
                type="button"
                onClick={() => window.open(buildQrAccessPath(qrToken), "_blank", "noopener,noreferrer")}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
              >
                Open Secure Page
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {String(row.additional_info ?? "").trim() ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Additional Info</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{row.additional_info}</p>
        </div>
      ) : null}
    </div>
  );
}
