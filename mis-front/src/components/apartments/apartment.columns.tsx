"use client";

import { Badge } from "@/components/ui/Badge";
import type { Column } from "@/components/ui/DataTable";
import type { ApartmentStatus, UsageType } from "@/components/apartments/apartment.types";
import { ApartmentRow } from "@/db/localDB";
import { resolveOfflineImageSrc } from "@/lib/imageThumb";

const statusColor: Record<ApartmentStatus, "blue" | "purple" | "amber" | "emerald"> = {
  available: "emerald",
  reserved: "amber",
  handed_over: "blue",
  sold: "purple",
  rented: "blue",
  company_use: "amber",
};

const normalizeStatus = (status: string): ApartmentStatus => {
  const value = status.trim().toLowerCase();
  if (value === "reserved" || value === "handed_over" || value === "sold" || value === "rented" || value === "company_use") return value;
  return "available";
};

const statusLabel = (status: ApartmentStatus): string => {
  if (status === "company_use") return "company use";
  if (status === "handed_over") return "handed over";
  return status;
};

const normalizeUsageType = (usageType: string): UsageType => {
  return usageType.trim().toLowerCase() === "commercial" ? "commercial" : "residential";
};

export const apartmentColumns: Column<ApartmentRow>[] = [
  {
    key: "apartment_image_url",
    label: "Image",
    render: (item) => {
      const imageSrc = resolveOfflineImageSrc(item);
      const fallback = item.apartment_code?.slice(0, 2).toUpperCase() || "--";

      return imageSrc ? (
        <img
          src={imageSrc}
          alt={item.apartment_code}
          className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-[#2a2a3e]"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-600 dark:bg-[#2a2a3e] dark:text-slate-300">
          {fallback}
        </div>
      );
    },
  },
  {
    key: "apartment_code",
    label: "Code",
    render: (item) => <span className="font-semibold">{item.apartment_code}</span>,
  },
  {
    key: "usage_type",
    label: "Usage",
    render: (item) => {
      const usage = normalizeUsageType(item.usage_type);
      return <Badge color={usage === "residential" ? "blue" : "purple"}>{usage}</Badge>;
    },
  },
  {
    key: "unit_number",
    label: "Unit",
    render: (item) => (
      <span>
        {item.block_number ? `${item.block_number}-` : ""}
        {item.unit_number} / Floor {item.floor_number || "-"}
      </span>
    ),
  },
  {
    key: "layout",
    label: "Layout",
    render: (item) => (
      <span>{`${item.bedrooms}BR / ${item.halls}Hall / ${item.bathrooms}Bath / ${item.kitchens}Kit`}</span>
    ),
  },
  {
    key: "area_sqm",
    label: "Area",
    render: (item) => <span>{`${item.area_sqm} sqm`}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (item) => {
      const status = normalizeStatus(item.status);
      return <Badge color={statusColor[status]}>{statusLabel(status)}</Badge>;
    },
  },
  {
    key: "balcony",
    label: "Balcony",
    render: (item) => <span>{item.balcony ? "Yes" : "No"}</span>,
  },
];
