"use client";

import type { DocumentTypeModuleKey, DocumentTypeRow } from "@/modules/document-types/document-types.repo";

export type AssetTypeOption = {
  value: string;
  label: string;
};

export const ASSET_TYPE_MODULE: DocumentTypeModuleKey = "company_assets";

export const DEFAULT_ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  { value: "vehicle", label: "Vehicle" },
  { value: "machine", label: "Machine" },
  { value: "tool", label: "Tool" },
  { value: "IT", label: "IT Equipment" },
];

export function buildAssetTypeLabelMap(rows: DocumentTypeRow[]): Map<string, string> {
  const labels = new Map<string, string>();

  for (const item of DEFAULT_ASSET_TYPE_OPTIONS) {
    labels.set(item.value, item.label);
  }

  for (const row of rows) {
    const code = String(row.code ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!code || !label) continue;
    labels.set(code, label);
  }

  return labels;
}

export function buildAssetTypeOptions(rows: DocumentTypeRow[], currentType?: string | null): AssetTypeOption[] {
  const options = new Map<string, string>();

  for (const row of rows) {
    const code = String(row.code ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!row.is_active || !code || !label) continue;
    options.set(code, label);
  }

  for (const item of DEFAULT_ASSET_TYPE_OPTIONS) {
    if (!options.has(item.value)) {
      options.set(item.value, item.label);
    }
  }

  const currentCode = String(currentType ?? "").trim();
  if (currentCode && !options.has(currentCode)) {
    const currentLabel =
      rows.find((row) => String(row.code ?? "").trim() === currentCode)?.label ??
      DEFAULT_ASSET_TYPE_OPTIONS.find((item) => item.value === currentCode)?.label ??
      currentCode.replaceAll("_", " ");
    options.set(currentCode, currentLabel);
  }

  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
