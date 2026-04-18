"use client";

import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";
import type { ReportBundle } from "@/modules/reports/reports.types";
import { formatCellValue, formatDateTimeLabel } from "@/modules/reports/reports.utils";

type Props = {
  bundle: ReportBundle;
};

export default function ModuleReportPrintView({ bundle }: Props) {
  return (
    <LetterheadPrintShell
      title={bundle.title}
      subtitle={`${bundle.scopeLabel} | Generated ${formatDateTimeLabel(bundle.generatedAt)}`}
      contentClassName="min-h-[297mm] px-[14mm] pb-[20mm] pt-[38mm]"
    >
      <div className="space-y-6 text-black">
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-black/80 bg-white/85 p-4">
            <div className="text-[15px] font-bold">Report Summary</div>
            <div className="mt-2 space-y-2 text-[13px] leading-6">
              <p><span className="font-bold">Report:</span> {bundle.title}</p>
              <p><span className="font-bold">Period:</span> {bundle.scopeLabel}</p>
              <p><span className="font-bold">Generated:</span> {formatDateTimeLabel(bundle.generatedAt)}</p>
              <p><span className="font-bold">Mode:</span> Offline-first cached report snapshot</p>
            </div>
          </div>
          <div className="rounded-xl border border-black/80 bg-white/85 p-4">
            <div className="text-[15px] font-bold">Report Metrics</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {bundle.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-black/60 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide">{metric.label}</div>
                  <div className="mt-1 text-[15px] font-bold">{metric.value}</div>
                  {metric.hint ? <div className="mt-1 text-[10px]">{metric.hint}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3">
            <h2 className="text-[17px] font-bold">{bundle.table.title}</h2>
            {bundle.table.subtitle ? <p className="text-[12px]">{bundle.table.subtitle}</p> : null}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {bundle.table.columns.map((column) => (
                  <th key={column.key} className="border border-black px-2 py-2 text-left font-bold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundle.table.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, bundle.table.columns.length)} className="border border-black px-3 py-6 text-center">
                    {bundle.emptyMessage}
                  </td>
                </tr>
              ) : (
                bundle.table.rows.map((row) => (
                  <tr key={row.id}>
                    {bundle.table.columns.map((column) => (
                      <td key={`${row.id}-${column.key}`} className="border border-black px-2 py-2 align-top">
                        {formatCellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(bundle.sections ?? []).map((section) => (
          <div key={section.key}>
            <div className="mb-3">
              <h2 className="text-[17px] font-bold">{section.title}</h2>
              {section.subtitle ? <p className="text-[12px]">{section.subtitle}</p> : null}
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {section.columns.map((column) => (
                    <th key={column.key} className="border border-black px-2 py-2 text-left font-bold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, section.columns.length)} className="border border-black px-3 py-6 text-center">
                      No section rows are available for the selected period.
                    </td>
                  </tr>
                ) : (
                  section.rows.map((row) => (
                    <tr key={row.id}>
                      {section.columns.map((column) => (
                        <td key={`${row.id}-${column.key}`} className="border border-black px-2 py-2 align-top">
                          {formatCellValue(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}

        <div className="flex justify-evenly pt-10 text-[12px] font-semibold">
          <div className="min-w-[48mm] text-center">
            <div className="border-b border-black pb-6" />
            <div className="mt-3">Prepared By</div>
          </div>
          <div className="min-w-[48mm] text-center">
            <div className="border-b border-black pb-6" />
            <div className="mt-3">Reviewed By</div>
          </div>
          <div className="min-w-[48mm] text-center">
            <div className="border-b border-black pb-6" />
            <div className="mt-3">Authorized Signature</div>
          </div>
        </div>
      </div>
    </LetterheadPrintShell>
  );
}
