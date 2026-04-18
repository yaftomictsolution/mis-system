"use client";

import type { ReactNode } from "react";

const LETTERHEAD_SRC = "/Letterhead01.jpg";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  paperClassName?: string;
  contentClassName?: string;
};

function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}

export default function LetterheadPrintShell({
  title,
  subtitle,
  children,
  paperClassName,
  contentClassName,
}: Props) {
  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: "Times New Roman", Calibri, serif;
        }
      `}</style>

      <div className="min-h-screen bg-[#ece7df] p-6 print:bg-white print:p-0">
        <div className="mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3 print:hidden">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div
          className={joinClasses(
            "mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white bg-cover bg-no-repeat text-black shadow-[0_15px_60px_rgba(15,23,42,0.16)] print:max-w-none print:shadow-none",
            paperClassName
          )}
          style={{ backgroundImage: `url('${LETTERHEAD_SRC}')`, backgroundPosition: "center top" }}
        >
          <div className={joinClasses("min-h-[297mm] px-[14mm] pb-[22mm] pt-[38mm]", contentClassName)}>{children}</div>
        </div>
      </div>
    </>
  );
}
