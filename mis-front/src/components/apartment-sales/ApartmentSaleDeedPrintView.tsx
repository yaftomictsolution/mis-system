"use client";

import type { ApartmentRow, ApartmentSaleRow, CustomerRow } from "@/db/localDB";

type Props = {
  sale: ApartmentSaleRow;
  customer?: CustomerRow | null;
  apartment?: ApartmentRow | null;
};

const EMPTY_PLACEHOLDER = "(                           )";

function toPersianDate(value: number | null | undefined): string {
  const date = typeof value === "number" && Number.isFinite(value) ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function splitAddressParts(address: string | null | undefined, count: number): string[] {
  const raw = String(address ?? "").trim();
  if (!raw) return Array.from({ length: count }, () => "");

  const parts = raw
    .split(/[\n,/-]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  while (parts.length < count) {
    parts.push("");
  }

  return parts.slice(0, count);
}

function lineValue(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyLabel(value: unknown): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} دالر امریکایی` : "";
}

function FieldRow({ label, value }: { label: string; value?: string }) {
  const hasValue = Boolean(String(value ?? "").trim());
  const displayValue = hasValue ? `( ${String(value).trim()} )` : EMPTY_PLACEHOLDER;

  return (
    <div className="flex min-h-[7mm] items-baseline gap-[2mm] text-[4.6mm] font-bold print:min-h-[5.7mm] print:gap-[1.4mm] print:text-[4mm]">
      <span className="shrink-0">{label}</span>
      <span className="min-h-[6.2mm] flex-1 whitespace-pre-wrap px-[1.5mm] print:min-h-[4.8mm] print:px-[1mm]">
        {displayValue}
      </span>
    </div>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[4mm] inline-flex min-h-[9mm] items-center rounded-full bg-[#d6a349] px-[5mm] text-[5mm] font-extrabold text-white print:mb-[3mm] print:min-h-[7.5mm] print:px-[4mm] print:text-[4.3mm]">
      {children}
    </div>
  );
}

function PhotoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[46mm] w-[36mm] items-center justify-center border border-slate-900 bg-white/70 text-center text-[4.6mm] font-bold leading-[1.35] print:h-[40mm] print:w-[50mm] print:text-[3.9mm]">
      {children}
    </div>
  );
}

export default function ApartmentSaleDeedPrintView({ sale, customer, apartment }: Props) {
  const saleLabel = sale.sale_id || sale.uuid.slice(0, 8).toUpperCase();
  const deedDate = toPersianDate(sale.deed_issued_at ?? sale.updated_at ?? Date.now());

  const [currentArea, currentDistrict, currentProvince] = splitAddressParts(customer?.address, 3);
  const [originArea, originDistrict, originProvince] = splitAddressParts(customer?.address, 3);

  const customerName = lineValue(customer?.name);
  const customerFatherName = lineValue(customer?.fname);
  const customerGrandFatherName = lineValue(customer?.gname);
  const customerPhone = lineValue(customer?.phone);
  const customerPhoneAlt = lineValue(customer?.phone1);
  const currentAddress = [currentArea, currentDistrict, currentProvince].filter(Boolean).join(" / ");
  const originAddress = [originArea, originDistrict, originProvince].filter(Boolean).join(" / ");

  const apartmentCode = lineValue(apartment?.apartment_code);
  const apartmentUnit = lineValue(apartment?.unit_number);
  const apartmentBlock = lineValue(apartment?.block_number);
  const apartmentFloor = lineValue(apartment?.floor_number);
  const apartmentRooms =
    typeof apartment?.bedrooms === "number" && Number.isFinite(apartment.bedrooms) ? String(apartment.bedrooms) : "";
  const apartmentArea =
    typeof apartment?.area_sqm === "number" && Number.isFinite(apartment.area_sqm)
      ? `${apartment.area_sqm} متر مربع`
      : "";

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          direction: rtl;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: Tahoma, "Noto Naskh Arabic", "Segoe UI", sans-serif;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          color: #020617;
        }

        @media print {
          .deed-page-content {
            zoom: 0.88;
          }
        }
      `}</style>

      <div
        dir="rtl"
        lang="fa"
        className="min-h-screen bg-stone-100 py-4 text-slate-950 antialiased print:bg-white print:py-0"
        style={{ fontFamily: 'Tahoma, "Noto Naskh Arabic", "Segoe UI", sans-serif' }}
      >
        <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-3 print:hidden">
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

        <div className="relative mx-auto w-full max-w-[210mm] overflow-hidden border-[1.5mm] border-[#d6a349] bg-[#f3f1ec] text-slate-950 shadow-xl print:h-[297mm] print:max-w-none print:shadow-none">
          <div className="pointer-events-none absolute inset-[4mm] border-[0.6mm] border-[#d6a349] print:inset-[3mm]" />

          <img alt="" src="/deed-assets/corner-top-left.png?v=20260309-3" className="pointer-events-none absolute left-0 top-0 w-[24mm] opacity-95 print:w-[22mm]" />
          <img alt="" src="/deed-assets/corner-top-right.png?v=20260309-3" className="pointer-events-none absolute right-0 top-0 w-[24mm] opacity-95 print:w-[22mm]" />
          <img alt="" src="/deed-assets/corner-bottom-left.png?v=20260309-3" className="pointer-events-none absolute bottom-0 left-0 w-[24mm] opacity-95 print:w-[22mm]" />
          <img alt="" src="/deed-assets/corner-bottom-right.png?v=20260309-3" className="pointer-events-none absolute bottom-0 right-0 w-[24mm] opacity-95 print:w-[22mm]" />
          <img alt="" src="/deed-assets/ornament-top-center.png?v=20260309-3" className="pointer-events-none absolute left-1/2 top-[0.2mm] w-[31mm] -translate-x-1/2 print:top-[0.4mm] print:w-[28mm]" />

          <div className="pointer-events-none absolute inset-x-[28mm] top-[62mm] bottom-[42mm] flex items-center justify-center opacity-[0.14]">
            <img
              alt=""
              src="/deed-assets/logo-right.png?v=20260309-3"
              className="h-full max-h-[185mm] w-full object-contain"
            />
          </div>

          <div className="deed-page-content relative z-10 flex min-h-[297mm] flex-col px-[8mm] pb-[7mm] pt-[10mm] print:h-[297mm] print:px-[6.5mm] print:pb-[5mm] print:pt-[7mm]">
            <header
              dir="ltr"
              className="mt-[5mm] flex items-center justify-between gap-[3mm] px-[10mm] print:gap-[2.5mm] print:px-[8mm]"
            >
              <div className="flex h-[38mm] w-[38mm] shrink-0 items-center justify-center bg-[#f3f1ec] print:h-[34mm] print:w-[34mm]">
                <img alt="" src="/deed-assets/logo-left.png?v=20260309-3" className="h-[94%] w-[94%] object-contain" />
              </div>

              <div dir="rtl" className="flex min-w-0 flex-1 flex-col items-center justify-center px-[2mm] text-center print:px-[1.5mm]">
                
                <h1 className="whitespace-nowrap text-[5.9mm] font-extrabold leading-[1.2] print:text-[5.1mm]">
                  شهرک رهایشی مکروریان ۱۳ ( شاداب ظفر )
                </h1>

                <h1 className="whitespace-nowrap text-[5.9mm] font-extrabold leading-[1.2] print:text-[5.1mm]">
                  ریاست شرکت ساختمانی شاداب ظفر
                </h1>

                <h2 className="whitespace-nowrap text-[5.1mm] font-extrabold leading-[1.2] print:text-[4.4mm]">
                  معاونیت اداری
                </h2>
                
                <h3 className="whitespace-nowrap text-[5.4mm] font-extrabold leading-[1.2] print:text-[4.7mm]">
                  مدیریت توزیع آپارتمانها
                </h3>
              </div>

              <div className="flex h-[38mm] w-[38mm] shrink-0 items-center justify-center bg-[#f3f1ec] print:h-[34mm] print:w-[34mm]">
                <img alt="" src="/deed-assets/logo-right.png?v=20260309-3" className="h-[94%] w-[94%] object-contain" />
              </div>
            </header>

            <div className="relative mx-[6mm] mb-[5.5mm] mt-[7mm] h-[4mm] print:mx-[7mm] print:mb-[4mm] print:mt-[5mm] print:h-[3.2mm]">
              <div className="absolute inset-x-0 top-[1.65mm] h-[1.2mm] rounded-full bg-[#1f1b1b] print:top-[1.2mm] print:h-[1mm]" />
              <div className="absolute left-1/2 top-0 h-[4mm] w-[54%] -translate-x-1/2 rounded-full bg-[#d6a349] print:h-[3.2mm] print:w-[52%]" />
            </div>

            <section className="mb-[5mm] grid grid-cols-[1fr_auto] items-center gap-[5mm] print:mb-[4mm] print:gap-[4mm]">
              <div className="flex min-h-[12mm] items-center justify-between rounded-full bg-[#d6a349] px-[7mm] text-[5.4mm] font-extrabold text-white print:min-h-[10mm] print:px-[5.5mm] print:text-[4.8mm]">
                <span>فورمه توزیع</span>
                <span className="min-w-[25mm] ps-[4mm] print:min-w-[20mm] print:ps-[2.5mm]">{saleLabel}</span>
              </div>
              <div className="flex min-h-[12mm] items-center justify-between rounded-full bg-[#d6a349] px-[7mm] text-[5.4mm] font-extrabold text-white print:min-h-[10mm] print:px-[5.5mm] print:text-[4.8mm]">
                <span>تاریخ</span>
                <span className="min-w-[25mm] ps-[4mm] print:min-w-[20mm] print:ps-[2.5mm]">{deedDate}</span>
              </div>
            </section>

            <section className="grid grid-cols-[1.3fr_0.85fr] gap-[6mm] print:gap-[5mm]">
              <div>
                <SectionTag>الف: شهرت مشتری:</SectionTag>
                <div className="grid grid-cols-2 gap-x-[8mm] gap-y-[4mm] print:gap-x-[6mm] print:gap-y-[3mm]">
                  <div className="grid gap-[2.1mm] print:gap-[1.4mm]">
                    <FieldRow label="اسم:" value={customerName} />
                    <FieldRow label="ولد:" value={customerFatherName} />
                    <FieldRow label="وظیفه:" value="" />
                    <FieldRow label="نمبر تذکره:" value="" />
                    <FieldRow label="قریه/ناحیه:" value={currentArea} />
                    <FieldRow label="ولسوالی:" value={currentDistrict} />
                    <FieldRow label="ولایت:" value={currentProvince} />
                  </div>
                  <div className="grid gap-[2.1mm] print:gap-[1.4mm]">
                    <FieldRow label="سکونت فعلی مشتری:" value={currentAddress} />
                    <FieldRow label="سکونت اصلی مشتری:" value={originAddress} />
                    <FieldRow label="شماره تماس:" value={customerPhone} />
                    <FieldRow label="شماره دوم:" value={customerPhoneAlt} />
                    <FieldRow label="نام پدرکلان:" value={customerGrandFatherName} />
                    <FieldRow label="مرجع ثبت:" value={saleLabel} />
                  </div>
                </div>
              </div>

              <div className="flex justify-start gap-[4mm] pt-[7mm] pr-[30%] print:gap-[3mm] print:pt-[4mm]">
                <PhotoBox>
                  <>عکس<br />مشتری</>
                </PhotoBox>
                <PhotoBox>
                  <>عکس<br />وکیل<br />مشتری</>
                </PhotoBox>
              </div>
            </section>

            <section className="mt-[4mm] print:mt-[3mm]">
              <SectionTag>ب: شهرت وکیل مشتری:</SectionTag>
              <div className="grid grid-cols-2 gap-x-[7mm] gap-y-[2.1mm] print:gap-x-[5mm] print:gap-y-[1.4mm]">
                <FieldRow label="اسم:" value="" />
                <FieldRow label="ولد:" value="" />
                <FieldRow label="ولدیت:" value="" />
                <FieldRow label="نمبر تذکره:" value="" />
                <FieldRow label="قرابت با مشتری:" value="" />
                <FieldRow label="نمبر تلفون:" value="" />
                <FieldRow label="سکونت فعلی:" value="" />
                <FieldRow label="سکونت اصلی:" value="" />
              </div>
            </section>

            <section className="mt-[4mm] print:mt-[3mm]">
              <SectionTag>ج: مشخصات آپارتمان:</SectionTag>
              <div className="grid grid-cols-3 gap-x-[7mm] gap-y-[2.4mm] print:gap-x-[5mm] print:gap-y-[1.8mm]">
                <FieldRow label="نمبر آپارتمان:" value={apartmentCode} />
                <FieldRow label="نمبر بلاک:" value={apartmentBlock} />
                <FieldRow label="منزل:" value={apartmentFloor} />
                <FieldRow label="تعداد اتاق:" value={apartmentRooms} />
                <FieldRow label="به مساحت:" value={apartmentArea} />
                <FieldRow label="واحد:" value={apartmentUnit} />
                <FieldRow label="قیمت سهم شرکت:" value={moneyLabel(sale.net_price ?? sale.total_price - sale.discount)} />
                <FieldRow label="مناصفه قیمت کل:" value={moneyLabel(sale.total_price)} />
                <FieldRow label="حدود اربعه آپارتمان:" value="" />
              </div>
            </section>

            <div className="mt-[3mm] text-justify text-[4.6mm] font-bold leading-[1.7] print:mt-[1.6mm] print:text-[3.8mm] print:leading-[1.34]">
              تحویلی سهم فیصدي شاروالی کابل و پول قباله شرعی بدوش مشتری محترم میباشد که به مراجع مربوطه تحویل نماید.
            </div>
            <div className="mt-[3mm] text-justify text-[4.6mm] font-bold leading-[1.7] print:mt-[1.6mm] print:text-[3.8mm] print:leading-[1.34]">
              اینجانب که شهرتم در فوق ذکر است به مندرجات فورمه هذا متعهد بوده و به آن موافقت کامل دارم.
            </div>
            <div className="mt-[5mm] text-center text-[4.6mm] font-bold leading-[1.7] print:mt-[3mm] print:text-[3.8mm] print:leading-[1.34]">
              (شصت و امضای مشتری)
            </div>

            <section className="mt-[4mm] print:mt-[3mm]">
              <SectionTag>د:</SectionTag>
              <div className="mt-0 text-justify text-[4.6mm] font-bold leading-[1.7] print:text-[3.8mm] print:leading-[1.34]">
                شرکت ساختمانی و خانه سازی شاداب ظفر متعهد است که آپارتمان مندرجه فورمه هذا را بعد از اعمار به دسترس مشتری مذکور قرار دهد.
              </div>
            </section>

            <section className="mt-[5mm] grid grid-cols-3 items-end gap-[6mm] print:mt-[2.5mm] print:gap-[4mm]">
              <div>
                <div className="mb-[9mm] text-center text-[4.8mm] font-extrabold print:mb-[4.5mm] print:text-[3.9mm]">امضای کمیسیون توزیع</div>
                <div className="grid gap-[6mm] print:gap-[3mm]">
                  <div className="flex items-center gap-[4mm] text-[4.5mm] font-bold print:gap-[2.4mm] print:text-[3.7mm]"><span className="min-w-[6mm] print:min-w-[4mm]">۱-</span><span className="whitespace-pre">{EMPTY_PLACEHOLDER}</span></div>
                  <div className="flex items-center gap-[4mm] text-[4.5mm] font-bold print:gap-[2.4mm] print:text-[3.7mm]"><span className="min-w-[6mm] print:min-w-[4mm]">۲-</span><span className="whitespace-pre">{EMPTY_PLACEHOLDER}</span></div>
                  <div className="flex items-center gap-[4mm] text-[4.5mm] font-bold print:gap-[2.4mm] print:text-[3.7mm]"><span className="min-w-[6mm] print:min-w-[4mm]">۳-</span><span className="whitespace-pre">{EMPTY_PLACEHOLDER}</span></div>
                </div>
              </div>
              <div>
                <div className="mb-[9mm] text-center text-[4.8mm] font-extrabold print:mb-[4.5mm] print:text-[3.9mm]">مدیر توزیع آپارتمانها</div>
                <div className="text-center text-[4.5mm] font-bold whitespace-pre print:text-[3.7mm]">{EMPTY_PLACEHOLDER}</div>
              </div>
              <div>
                <div className="mb-[9mm] text-center text-[4.8mm] font-extrabold print:mb-[4.5mm] print:text-[3.9mm]">رئیس شرکت ساختمانی شاداب ظفر</div>
                <div className="text-center text-[4.5mm] font-bold whitespace-pre print:text-[3.7mm]">{EMPTY_PLACEHOLDER}</div>
              </div>
            </section>

            <div className="mt-auto grid grid-cols-[auto_1fr] items-start gap-[3mm] pt-[5mm] text-[4.6mm] font-extrabold leading-[1.6] print:gap-[2mm] print:pt-[2mm] print:text-[3.7mm] print:leading-[1.28]">
              <span className="rounded-full bg-[#1f1b1b] px-[4mm] py-[1mm] text-white print:px-[2.5mm] print:py-[0.5mm]">نوت:</span>
              <span>فورمه هذا در سه کاپی ترتیب شده که کاپی به شاروالی، کاپی به شرکت و کاپی به مشتری یا وکیل وی بعد از طی مراحل داده میشود.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


