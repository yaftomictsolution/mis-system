"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormField } from "@/components/ui/FormField";
import type {
  ApartmentFormData,
  UsageType,
  ApartmentStatus,
} from "@/components/apartments/apartment.types";

type ApartmentFormProps = {
  open: boolean;
  mode: "create" | "edit";
  value: ApartmentFormData;
  error?: string | null;
  submitting?: boolean;
  onChange: Dispatch<SetStateAction<ApartmentFormData>>;
  onCancel: () => void;
  onSubmit: () => void;
};

export default function ApartmentForm({
  open,
  mode,
  value,
  error,
  submitting = false,
  onChange,
  onCancel,
  onSubmit,
}: ApartmentFormProps) {
  const isEditing = mode === "edit";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mb-6 overflow-hidden"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Update Apartment" : "Create Apartment"}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="Apartment Code"
                value={value.apartment_code}
                onChange={(v) => onChange((p) => ({ ...p, apartment_code: String(v) }))}
                placeholder="A-101"
                required
              />
              <FormField
                label="Usage Type"
                type="select"
                value={value.usage_type}
                onChange={(v) => onChange((p) => ({ ...p, usage_type: v as UsageType }))}
                options={[
                  { value: "residential", label: "residential" },
                  { value: "commercial", label: "commercial" },
                ]}
                required
              />
              <FormField
                label="Block Number"
                value={value.block_number}
                onChange={(v) => onChange((p) => ({ ...p, block_number: String(v) }))}
                placeholder="A"
              />
              <FormField
                label="Unit Number"
                value={value.unit_number}
                onChange={(v) => onChange((p) => ({ ...p, unit_number: String(v) }))}
                placeholder="101"
                required
              />
              <FormField
                label="Floor Number"
                value={value.floor_number}
                onChange={(v) => onChange((p) => ({ ...p, floor_number: String(v) }))}
                placeholder="1 / G"
              />
              <FormField
                label="Bedrooms"
                type="number"
                value={value.bedrooms}
                onChange={(v) => onChange((p) => ({ ...p, bedrooms: Number(v) || 0 }))}
              />
              <FormField
                label="Halls"
                type="number"
                value={value.halls}
                onChange={(v) => onChange((p) => ({ ...p, halls: Number(v) || 0 }))}
              />
              <FormField
                label="Bathrooms"
                type="number"
                value={value.bathrooms}
                onChange={(v) => onChange((p) => ({ ...p, bathrooms: Number(v) || 0 }))}
              />
              <FormField
                label="Kitchens"
                type="number"
                value={value.kitchens}
                onChange={(v) => onChange((p) => ({ ...p, kitchens: Number(v) || 0 }))}
              />
              <FormField
                label="Balcony"
                type="select"
                value={value.balcony}
                onChange={(v) => onChange((p) => ({ ...p, balcony: v as "yes" | "no" }))}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
              <FormField
                label="Area (sqm)"
                type="number"
                value={value.area_sqm}
                onChange={(v) => onChange((p) => ({ ...p, area_sqm: String(v) }))}
                placeholder="95.5"
              />
              <FormField
                label="Status"
                type="select"
                value={value.status}
                onChange={(v) => onChange((p) => ({ ...p, status: v as ApartmentStatus }))}
                options={[
                  { value: "available", label: "available" },
                  { value: "reserved", label: "reserved" },
                  { value: "handed_over", label: "handed_over" },
                  { value: "sold", label: "sold" },
                  { value: "rented", label: "rented" },
                  { value: "company_use", label: "company_use" },
                ]}
              />
              <FormField
                label="Apartment Shape"
                value={value.apartment_shape}
                onChange={(v) => onChange((p) => ({ ...p, apartment_shape: String(v) }))}
                placeholder="L-shape"
              />
              <FormField
                label="Corridor"
                value={value.corridor}
                onChange={(v) => onChange((p) => ({ ...p, corridor: String(v) }))}
                placeholder="North Wing"
              />
              <FormField
                label="North Boundary"
                value={value.north_boundary}
                onChange={(v) => onChange((p) => ({ ...p, north_boundary: String(v) }))}
                placeholder="Road / Building / Plot"
              />
              <FormField
                label="South Boundary"
                value={value.south_boundary}
                onChange={(v) => onChange((p) => ({ ...p, south_boundary: String(v) }))}
                placeholder="Road / Building / Plot"
              />
              <FormField
                label="East Boundary"
                value={value.east_boundary}
                onChange={(v) => onChange((p) => ({ ...p, east_boundary: String(v) }))}
                placeholder="Road / Building / Plot"
              />
              <FormField
                label="West Boundary"
                value={value.west_boundary}
                onChange={(v) => onChange((p) => ({ ...p, west_boundary: String(v) }))}
                placeholder="Road / Building / Plot"
              />
              <FormField
                label="QR Code"
                value={value.qr_code}
                onChange={(v) => onChange((p) => ({ ...p, qr_code: String(v) }))}
                placeholder="QR-A101"
              />
            </div>

            <div className="mt-4">
              <FormField
                label="Additional Info"
                type="textarea"
                value={value.additional_info}
                onChange={(v) => onChange((p) => ({ ...p, additional_info: String(v) }))}
                placeholder="Any extra details..."
                rows={3}
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (isEditing ? "Updating..." : "Saving...") : isEditing ? "Update Apartment" : "Add Apartment"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
