"use client";

import { useMemo, type ReactNode } from "react";
import type {
  ApartmentRow,
  ApartmentSaleFinancialRow,
  ApartmentSaleRow,
  CustomerRow,
  SystemDocumentLocalRow,
} from "@/db/localDB";

type Props = {
  sale: ApartmentSaleRow;
  customer?: CustomerRow | null;
  apartment?: ApartmentRow | null;
  financial?: ApartmentSaleFinancialRow | null;
  customerDocuments?: SystemDocumentLocalRow[];
};

const TEMPLATE_SRC = "/deed3.jpeg";
const BRAND_GOLD = "#e7b155";
const FONT_STACK_REGULAR = `"BahijJanna", "Noto Naskh Arabic", "Tahoma", serif`;
const FONT_STACK_BOLD = `"BahijJannaBold", "BahijJanna", "Noto Naskh Arabic", "Tahoma", serif`;
const DEFAULT_INLINE_EMPTY_WIDTH = "17mm";
const DEFAULT_COMPACT_EMPTY_WIDTH = "25mm";
const RIBBON_TEXT_SIZE = "16.9px";
const RIBBON_VALUE_SIZE = "17.2px";
const MAIN_SECTION_PILL_SIZE = "15px";
const SUB_SECTION_PILL_SIZE = "11.6px";
const FIELD_LABEL_SIZE = "13.2px";
const FIELD_VALUE_SIZE = "12.8px";
const INLINE_LABEL_SIZE = "13px";
const INLINE_VALUE_SIZE = "12.6px";
const INLINE_UNIT_SIZE = "11.8px";
const PHOTO_CAPTION_SIZE = "12.4px";
const SIGNATURE_DOT_SIZE = "15px";
const SIGNATURE_TITLE_SIZE = "10.5px";
const CUSTOMER_SIGN_SIZE = "14.6px";

function toMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function toSlashDateLabel(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "-";
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;
}

function pickLatestDocument(documents: SystemDocumentLocalRow[], types: string[]): SystemDocumentLocalRow | null {
  const allowed = new Set(types.map((item) => item.trim().toLowerCase()).filter(Boolean));
  return (
    [...documents]
      .filter((row) => allowed.has(String(row.document_type ?? "").trim().toLowerCase()))
      .sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0))[0] ?? null
  );
}

function normalizeText(value: string | number | null | undefined, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeResidence(area?: string | null, district?: string | null, province?: string | null) {
  return {
    area: normalizeText(area),
    district: normalizeText(district),
    province: normalizeText(province),
  };
}

function InlineApartmentField({
  label,
  value,
  minWidth = "6.8mm",
  emptyWidth = DEFAULT_INLINE_EMPTY_WIDTH,
  unit,
  className = "",
}: {
  label: string;
  value: string;
  minWidth?: string;
  emptyWidth?: string;
  unit?: string;
  className?: string;
}) {
  const displayValue = value === "-" ? "" : value;
  const valueStyle = displayValue ? { minWidth } : { minWidth, width: emptyWidth };

  return (
    <div className={`inline-flex shrink-0 items-end gap-[0.35mm] whitespace-nowrap ${className}`.trim()}>
      <div
        className="shrink-0 leading-none text-slate-950"
        style={{ fontFamily: FONT_STACK_BOLD, fontSize: INLINE_LABEL_SIZE, fontWeight: 700 }}
      >
        {label}
      </div>
      <div
        className="inline-flex items-end justify-center gap-0 px-[0.15mm] pb-[0.1mm] text-center leading-none text-slate-900"
        style={{ fontFamily: FONT_STACK_REGULAR, fontSize: INLINE_VALUE_SIZE, fontWeight: 600 }}
      >
        <span className="leading-none">(</span>
        <span className="inline-block px-[0.55mm] text-center" style={valueStyle}>
          {displayValue || "\u00A0"}
        </span>
        <span className="leading-none">)</span>
      </div>
      {unit ? (
        <div
          className="shrink-0 leading-none text-slate-950"
          style={{ fontFamily: FONT_STACK_REGULAR, fontSize: INLINE_UNIT_SIZE, fontWeight: 600 }}
        >
          {unit}
        </div>
      ) : null}
    </div>
  );
}

function CompactFieldLine({
  label,
  value,
  minWidth = "11mm",
  emptyWidth = DEFAULT_COMPACT_EMPTY_WIDTH,
  labelGap = "3.5mm",
  className = "",
}: {
  label: string;
  value: string;
  minWidth?: string;
  emptyWidth?: string;
  labelGap?: string;
  className?: string;
}) {
  const displayValue = value === "-" ? "" : value;
  const valueStyle = displayValue ? { minWidth } : { minWidth, width: emptyWidth };

  return (
    <div className={`flex w-fit max-w-full items-end ${className}`.trim()} style={{ gap: labelGap }}>
      <div className="shrink-0 leading-none text-slate-950" style={{ fontFamily: FONT_STACK_BOLD, fontSize: FIELD_LABEL_SIZE, fontWeight: 700 }}>
        {label}
      </div>
      <div
        className="inline-flex min-h-[15px] items-end justify-center gap-0 px-[0.1mm] pb-[0.05mm] text-center leading-none text-slate-900"
        style={{ fontFamily: FONT_STACK_REGULAR, fontSize: FIELD_VALUE_SIZE, fontWeight: 600 }}
      >
        <span className="leading-none">(</span>
        <span className="inline-block px-[0.7mm] text-center" style={valueStyle}>
          {displayValue || "\u00A0"}
        </span>
        <span className="leading-none">)</span>
      </div>
    </div>
  );
}
function SectionPill({
  title,
  className = "",
  fontSize = MAIN_SECTION_PILL_SIZE,
}: {
  title: string;
  className?: string;
  fontSize?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-white ${className}`.trim()}
      style={{ backgroundColor: BRAND_GOLD, fontFamily: FONT_STACK_BOLD, fontSize, fontWeight: 700 }}
    >
      {title}
    </div>
  );
}

function PhotoCard({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="space-y-1">
      <div className="overflow-hidden rounded-[10px] border-[1.6px] border-slate-900 bg-white">
        <div className="aspect-[3/4] w-full bg-white">
          {src ? <img src={src} alt="" decoding="async" className="h-full w-full object-cover" /> : null}
        </div>
      </div>
      <div className="text-center leading-snug text-slate-900" style={{ fontFamily: FONT_STACK_BOLD, fontSize: PHOTO_CAPTION_SIZE, fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

function SignatureColumn({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-[1.5mm] text-right">
      <div className="leading-none text-slate-950" style={{ fontFamily: FONT_STACK_BOLD, fontSize: SIGNATURE_DOT_SIZE, fontWeight: 700 }}>
     
      </div>
      <div
        className="max-w-[48mm] text-slate-950"
        style={{ fontFamily: FONT_STACK_BOLD, fontSize: SIGNATURE_TITLE_SIZE, fontWeight: 700, lineHeight: "3.45mm" }}
      >
        {title}
      </div>
      <div className="leading-none text-slate-950" style={{ fontFamily: FONT_STACK_BOLD, fontSize: SIGNATURE_DOT_SIZE, fontWeight: 700 }}>
        
      </div>
    </div>
  );
}

function AbsoluteSection({
  top,
  right,
  left,
  title,
  titleClassName = "",
  children,
}: {
  top: string;
  right: string;
  left: string;
  title: string;
  titleClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="absolute" style={{ top, right, left }}>
      <div className="mb-[3mm] flex">
        <SectionPill title={title} className={titleClassName} />
      </div>
      {children}
    </section>
  );
}

export default function ApartmentSaleDeedPrintView({
  sale,
  customer,
  apartment,
  financial,
  customerDocuments = [],
}: Props) {
  const buyerPhoto = useMemo(() => pickLatestDocument(customerDocuments, ["customer_image"]), [customerDocuments]);
  const representativePhoto = useMemo(
    () => pickLatestDocument(customerDocuments, ["customer_representative_image"]),
    [customerDocuments],
  );

  const buyerPhotoSrc =
    buyerPhoto?.file_url ||
    buyerPhoto?.download_url ||
    customer?.customer_image_url ||
    customer?.customer_image_thumb ||
    null;
  const representativePhotoSrc =
    representativePhoto?.file_url ||
    representativePhoto?.download_url ||
    customer?.customer_representative_image_url ||
    null;

  const deedDate = toSlashDateLabel(sale.deed_issued_at ?? sale.sale_date ?? sale.updated_at ?? 0);
  const formNumber = normalizeText(sale.sale_id || sale.uuid.slice(0, 8).toUpperCase());
  const buyerCurrent = normalizeResidence(customer?.current_area || customer?.address, customer?.current_district, customer?.current_province);
  const buyerOriginal = normalizeResidence(customer?.original_area, customer?.original_district, customer?.original_province);
  const representativeCurrentResidence = normalizeResidence(
    customer?.representative_current_area,
    customer?.representative_current_district,
    customer?.representative_current_province,
  );
  const representativeOriginalResidence = normalizeResidence(
    customer?.representative_original_area,
    customer?.representative_original_district,
    customer?.representative_original_province,
  );
  const representativeName = normalizeText(customer?.representative_name);
  const representativeFatherName = normalizeText(customer?.representative_fname);
  const representativeGrandfatherName = normalizeText(customer?.representative_gname);
  const representativeJobTitle = normalizeText(customer?.representative_job_title);
  const representativeRelationship = normalizeText(customer?.representative_relationship);
  const representativePhone = normalizeText(customer?.representative_phone);
  const representativeTazkiraNumber = normalizeText(customer?.representative_tazkira_number);
  const roomCount = Math.max(0, Number(apartment?.bedrooms ?? 0) + Number(apartment?.halls ?? 0));
  const companyShare = Number(
    financial?.company_share_85 ??
      (Number.isFinite(Number(sale.total_price)) ? Number(sale.total_price) * 0.85 : sale.net_price ?? 0),
  );
  const municipalityShare = Number(
    financial?.municipality_share_15 ??
      (Number.isFinite(Number(sale.total_price)) ? Number(sale.total_price) * 0.15 : 0),
  );
  const declarationCustomerName = normalizeText(customer?.name);
  const declarationApartment = normalizeText(apartment?.unit_number || apartment?.apartment_code);
  const declarationLines = useMemo(
    () => [
      `اینجانب ${declarationCustomerName} که شهرت‌ام در فوق ذکر است، به مندرجات این فورمه متعهد می‌باشم.`,
      `آپارتمان شماره ${declarationApartment} را به بیع قطعی خریداری نموده‌ام و سهم ۸۵ فیصد شرکت و سهم ۱۵ فیصد شاروالی را`,
      "مطابق شرط‌نامه در وقت و زمان معین تصفیه می‌نمایم.",
    ],
    [declarationApartment, declarationCustomerName],
  );
  const declarationLayout = useMemo(() => {
    const longestLine = Math.max(...declarationLines.map((line) => line.length));

    if (longestLine > 88) {
      return {
        top: "193.4mm",
        left: "13mm",
        right: "16mm",
        fontSize: "11px",
        lineHeight: "4.3mm",
        respectTop: "254.6mm",
        respectTop1:"219.6mm",
        customerSignTop: "254.95mm",
        customerSignTop1: "220.95mm",
        signaturesTop: "261.9mm",
        signaturesTop1: "238.9mm",
        noteTop: "280.2mm",
        noteTop1: "268.2mm",
        noteFontSize: "8.9px",
        noteLineHeight: "2.65mm",
        copiesBottom: "3.4mm",
        copiesBottom1: "14.4mm",
        copiesFontSize: "8px",
      };
    }

    if (longestLine > 76) {
      return {
        top: "240.1mm",
        left: "14mm",
        right: "14mm",
        fontSize: "10.8px",
        lineHeight: "4.55mm",
        respectTop: "254.9mm",
        customerSignTop: "255.25mm",
        signaturesTop: "262.5mm",
        noteTop: "281.1mm",
        noteFontSize: "7.05px",
        noteLineHeight: "2.8mm",
        copiesBottom: "3.8mm",
        copiesFontSize: "8.2px",
      };
    }

    return {
      top: "220mm",
      left: "16mm",
      right: "16mm",
      fontSize: "11.5px",
      lineHeight: "4.95mm",
      respectTop: "255.2mm",
      customerSignTop: "255.6mm",
      signaturesTop: "263.5mm",
      signaturesTop1: "237.9mm",
      noteTop: "282.6mm",
      noteFontSize: "7.2px",
      noteLineHeight: "2.95mm",
      copiesBottom: "4.2mm",
      copiesFontSize: "8.4px",
    };
  }, [declarationLines]);

  return (
    <>
      <style jsx global>{`
        @font-face {
          font-family: "BahijJanna";
          src:
            local("Bahij Janna"),
            local("Bahij Janna Regular"),
            local("Bahij Janna-Reqular");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: "BahijJannaBold";
          src:
            local("Bahij Janna Bold"),
            local("Bahij Janna-Bold"),
            local("Baji Janna Bold"),
            local("Baji_Janna-Bold");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          direction: rtl;
          unicode-bidi: isolate;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: ${FONT_STACK_REGULAR};
          background: #fff;
        }
      `}</style>

      <div className="min-h-screen bg-[#ece7df] p-3 print:bg-white print:p-0">
        <div className="mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3 print:hidden">
          <div className="text-right">
            <div className="text-lg text-slate-900" style={{ fontFamily: FONT_STACK_BOLD, fontWeight: 700 }}>
              سند توزیع آپارتمان
            </div>
            <div className="text-sm text-slate-500" style={{ fontFamily: FONT_STACK_REGULAR }}>
              {formNumber}
            </div>
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

        <div className="mx-auto w-[210mm] bg-white shadow-[0_15px_60px_rgba(15,23,42,0.16)] print:shadow-none">
          <div
            className="relative h-[297mm] w-[210mm] overflow-hidden bg-white bg-no-repeat"
            dir="rtl"
            style={{ backgroundImage: `url('${TEMPLATE_SRC}')`, backgroundPosition: "center top", backgroundSize: "100% 100%" }}
          >

            <div className="absolute left-[17mm] top-[168px] h-[1mm] w-[176mm] bg-[#1a1715]" />
            <div className="absolute left-[58mm] top-[43.6mm] h-[2.6mm] w-[94mm] rounded-full" style={{ backgroundColor: BRAND_GOLD }} />

            <div
              className="absolute left-[14mm] right-[14mm] top-[50.5mm] flex h-[13mm] items-center justify-between rounded-[999px] px-[12mm] text-white"
              style={{ backgroundColor: BRAND_GOLD, fontFamily: FONT_STACK_BOLD, fontWeight: 700 }}
            >
              <div className="flex items-center gap-3" style={{ fontSize: RIBBON_TEXT_SIZE }}>
                <span>فورمه توزیع</span>
                <span className="inline-block min-w-[44mm] border-b border-white text-center leading-tight" style={{ fontSize: RIBBON_VALUE_SIZE }}>
                  {formNumber}
                </span>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: RIBBON_TEXT_SIZE }}>
                <span>تاریخ:</span>
                <span className="inline-block min-w-[42mm]  border-white text-center leading-tight" style={{ fontSize: RIBBON_VALUE_SIZE }}>
                  {deedDate}
                </span>
              </div>
            </div>

            <div className="absolute left-[16mm] top-[74mm]  z-20 w-[56mm]">
              <div className="grid grid-cols-2 gap-[4mm]">
                <PhotoCard label="عکس مشتری" src={buyerPhotoSrc} />
                <PhotoCard label="عکس وکیل مشتری" src={representativePhotoSrc} />
              </div>
            </div>
            <AbsoluteSection
              top="74mm"
              right="16mm"
              left="76mm"
              title="الف: شهرت مشتری"
              titleClassName="min-w-[43mm] justify-center px-[4.2mm] py-[0.9mm]"
            >
              <div className="grid grid-cols-2 items-start gap-x-[2.8mm] gap-y-[1.15mm]">
                   <CompactFieldLine
                    label="اسم:-"
                    value={normalizeText(customer?.name)}
                    minWidth="24mm"
                    labelGap="4mm"
                    />

                   <CompactFieldLine
                    label={"وظیفه:-"}
                    value={normalizeText(customer?.job_title)}
                    minWidth="24mm"
                    labelGap="10mm"
                    />

                 <CompactFieldLine
                    label="ولد:-"
                    value={normalizeText(customer?.fname)}
                    minWidth="24mm"
                    labelGap="6mm"
                    />
                    <CompactFieldLine
                    label={"نمبر تذکره:-"}
                    value={normalizeText(customer?.tazkira_number)}
                    minWidth="24mm"
                    labelGap="4mm"
                    />
                <CompactFieldLine
                  label="نمبر تماس:-"
                  value={normalizeText(customer?.phone)}
                  minWidth="40mm"
                  labelGap="0.5mm"
                  className="col-span-2"
                />
              </div>
              <div className="mt-[2.2mm] grid grid-cols-2 gap-[2.2mm]">
                <div>
                  <div className="mb-[1.2mm] flex justify-end">
                    <SectionPill title="سکونت فعلی مشتری" className="px-[3.1mm] py-[0.75mm]" fontSize={SUB_SECTION_PILL_SIZE} />
                  </div>
                  <div className="space-y-[1.15mm]">
                    <CompactFieldLine
                    label="قریه/ناحیه:-"
                    value={buyerCurrent.area}
                    minWidth="30mm"
                    labelGap="0mm"
                    />
                    <CompactFieldLine
                    label="ولسوالی:-"
                    value={buyerCurrent.district}
                    minWidth="30mm"
                    labelGap="3mm"
                    />
                    <CompactFieldLine
                    label="ولایت:-"
                    value={buyerCurrent.province}
                    minWidth="30mm"
                    labelGap="9mm"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-[1.2mm] flex justify-end">
                    <SectionPill title="سکونت اصلی مشتری" className="px-[3.1mm] py-[0.75mm]" fontSize={SUB_SECTION_PILL_SIZE} />
                  </div>
                  <div className="space-y-[1.15mm]">
                    <CompactFieldLine
                    label="قریه/ناحیه:-"
                    value={buyerOriginal.area}
                    minWidth="30mm"
                    labelGap="1mm"
                    />
                    <CompactFieldLine
                    label="ولسوالی:-"
                    value={buyerOriginal.district}
                    minWidth="30mm"
                    labelGap="4mm"
                    />
                    <CompactFieldLine
                    label="ولایت:-"
                    value={buyerOriginal.province}
                    minWidth="30mm"
                    labelGap="10mm"
                    />
                  </div>
                </div>
              </div>
            </AbsoluteSection>
            {/*  */}
            <AbsoluteSection top="129mm" right="16mm" left="16mm" title="ب: شهرت وکیل مشتری" titleClassName="min-w-[46mm] justify-center px-[4.2mm] py-[0.9mm]">
               <div className="space-y-[1.1mm]">
                  <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                    <CompactFieldLine
                     label="اسم:-"  
                      value={representativeName}
                      minWidth="20mm"
                    />
                    <CompactFieldLine
                     label="ولد:-" 
                      value={representativeFatherName}
                      minWidth="20mm"
                    />
                    <CompactFieldLine
                      label="ولدیت:-" 
                      value={representativeGrandfatherName}
                      minWidth="20mm"
                    />
                    <CompactFieldLine
                      label="نمبر تسکره:-"
                      value={representativeTazkiraNumber}
                      minWidth="20mm"
                    />
                  </div>

                  <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                    <CompactFieldLine
                     label="وظیفه:-"
                      value={representativeJobTitle}
                      minWidth="20mm"
                      labelGap="7mm"
                    />

                    <CompactFieldLine
                     label="قرابت با مشتری:-"
                      value={representativeRelationship}
                      minWidth="20mm"
                      labelGap="7mm"
                    />
                    <CompactFieldLine
                     label="نمبر تماس:-"
                      value={representativePhone}
                      minWidth="20mm"
                      labelGap="2mm"
                    />
                  </div>
                   <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                  
                   <CompactFieldLine
                     label="سکونت فعلی:-"
                      value={representativeCurrentResidence.area}
                      minWidth="20mm"
                      labelGap="2mm"
                    />
                     <CompactFieldLine
                     label="ولسوالی:-"
                      value={representativeCurrentResidence.district}
                      minWidth="20mm"
                      labelGap="2mm"
                    />
                    <CompactFieldLine
                    label="ولایت:-"
                      value={representativeCurrentResidence.province}
                      minWidth="20mm"
                      labelGap="2mm"
                    />

                  </div>
                  <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                     <CompactFieldLine
                    label="سکونت اصلی:-"
                      value={representativeOriginalResidence.area}
                      minWidth="20mm"
                      labelGap="2mm"
                    />

                    <CompactFieldLine
                    label="ولسوالی:-"
                      value={representativeOriginalResidence.district}
                      minWidth="20mm"
                      labelGap="2mm"
                    />

                     <CompactFieldLine
                    label="ولایت:-"
                      value={representativeOriginalResidence.province}
                      minWidth="20mm"
                      labelGap="2mm"
                    />

                </div>
              </div>

            </AbsoluteSection>
            {/*  */}
            <AbsoluteSection top="165mm" right="16mm" left="16mm" title="ج: مشخصات آپارتمان">
              <div className="space-y-[1.1mm]">
                <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                  <InlineApartmentField label="نمبر بلاک:-" value={normalizeText(apartment?.block_number)} minWidth="10mm" />
                  <InlineApartmentField
                    label="نمبر آپارتمان:-"
                    value={normalizeText(apartment?.unit_number || apartment?.apartment_code)}
                    minWidth="15mm"
                  />
                  <InlineApartmentField label="منزل:-" value={normalizeText(apartment?.floor_number)} minWidth="4.4mm" />
                  <InlineApartmentField label="تعداد اطاق:-" value={roomCount > 0 ? String(roomCount) : "-"} minWidth="10mm" />
                  <InlineApartmentField
                    label="به مساحت:-"
                    value={apartment?.area_sqm ? String(apartment.area_sqm) : "-"}
                    minWidth="10mm"
                    unit="متر مربع"
                  />
                </div>

                <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[2.15mm]">
                  <InlineApartmentField label="قیمت سهم ۸۵٪ شرکت:-" value={toMoney(companyShare)} minWidth="15mm" />
                  <InlineApartmentField label="سهم ۱۵٪ شاروالی کابل:-" value={toMoney(municipalityShare)} minWidth="15mm" />
                </div> 

                <div className="flex w-fit max-w-full flex-nowrap items-end justify-start gap-[1.15mm]">
                  <InlineApartmentField label="حدود اربعه آپارتمان:- شمالاً" value={normalizeText(apartment?.north_boundary)} minWidth="4.8mm" emptyWidth="10mm" />
                  <InlineApartmentField label="جنوباً" value={normalizeText(apartment?.south_boundary)} minWidth="4.8mm" emptyWidth="10mm" />
                  <InlineApartmentField label="شرقاً" value={normalizeText(apartment?.east_boundary)} minWidth="4.8mm" emptyWidth="10mm" />
                  <InlineApartmentField label="غرباً" value={normalizeText(apartment?.west_boundary)} minWidth="4.8mm" emptyWidth="10mm" />
                </div>
              </div>
            </AbsoluteSection>

            <div
              className="absolute  text-slate-950"
              style={{
                ...declarationLayout, 
                fontFamily: FONT_STACK_REGULAR,
                fontWeight: 700,
              }}
            >
              <div className="space-y-[0.55mm]">
                {declarationLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </div>
          
            <div className="absolute right-[39mm]" style={{ top: declarationLayout.respectTop1 }}>
              <SectionPill title="با احترام" />
            </div>

            <div
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-slate-950"
              style={{ top: declarationLayout.customerSignTop1, fontFamily: FONT_STACK_BOLD, fontSize: CUSTOMER_SIGN_SIZE, fontWeight: 700 }}
            >
              ( شصت و امضای مشتری )
            </div>

            <div className="absolute left-[16mm] right-[9mm] grid grid-cols-3 gap-[6mm]" style={{ top: declarationLayout.signaturesTop1 }}>
              <SignatureColumn title="امضای کمیسیون توزیع" />
              <SignatureColumn title="مهر و امضای مدیر توزیع آپارتمان‌ها" />
              <SignatureColumn title="رئیس شرکت ساختمانی شاداب ظفر" />
            </div>

            <div
              className="absolute left-[13mm] right-[13mm] px-[2mm] text-center text-slate-950"
              style={{
                top: declarationLayout.noteTop1,
                fontFamily: FONT_STACK_REGULAR,
                fontWeight: 600,
                fontSize: declarationLayout.noteFontSize,
                lineHeight: declarationLayout.noteLineHeight,
              }}
            >
              <span style={{ fontFamily: FONT_STACK_BOLD, fontWeight: 700,fontSize:"12px",background:"black",color:"#fff" }}>نوت:</span> فورمه توزیع تنها برای تثبیت آپارتمان و قیمت آپارتمان برای مشتری داده می‌شود و این فورمه سند ملکیت عرفی (قباله عرفی) محسوب نمی‌گردد.
            </div>

            <div
              className="absolute left-[16mm] right-[16mm] grid grid-cols-3 items-center gap-[4mm] text-slate-950"
              style={{
                bottom: declarationLayout.copiesBottom1,
                fontFamily: FONT_STACK_BOLD,
                fontWeight: 700,
                fontSize: declarationLayout.copiesFontSize,
                lineHeight: "2.6mm",
              }}
            >
              <span className="text-center">☐ کاپی به مشتری</span>
              <span className="text-center">☐ کاپی به شرکت</span>
              <span className="text-center">☐ کاپی به شاروالی</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
