"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import ApartmentSaleFinancialPanel, {
  createEmptyFinancialForm,
  createEmptyReceiptForm,
  toFinancialForm,
  type CompanyInstallmentPaymentRow,
  type FinancialFormData,
  type ReceiptFormData,
} from "@/components/apartment-sales/ApartmentSaleFinancialPanel";
import type { ApartmentSaleFinancialRow, ApartmentSaleRow, InstallmentRow } from "@/db/localDB";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  apartmentSaleGetLocal,
  apartmentSaleIssueDeed,
  apartmentSalePullToLocal,
} from "@/modules/apartment-sales/apartment-sales.repo";
import {
  apartmentSaleFinancialGetLocal,
  apartmentSaleFinancialUpdateLocal,
} from "@/modules/apartment-sale-financials/apartment-sale-financials.repo";
import { installmentsListLocal, installmentsPullToLocal } from "@/modules/installments/installments.repo";
import {
  municipalityLetterGenerate,
  municipalityLetterGet,
  municipalityReceiptCreate,
  municipalityReceiptList,
  type MunicipalityLetter,
  type MunicipalityReceipt,
} from "@/modules/apartment-sale-financials/municipality-workflow.repo";

export default function ApartmentSaleFinancialPage() {
  const COMPANY_SHARE_RATIO = 0.85;

  const toMoney = (value: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(2));
  };

  const toCompanyInstallmentRow = (item: InstallmentRow): CompanyInstallmentPaymentRow => {
    const installmentAmount = toMoney(item.amount ?? 0);
    const paidAmount = toMoney(item.paid_amount ?? 0);
    const companyShareAmount = toMoney(installmentAmount * COMPANY_SHARE_RATIO);
    const companySharePaid = toMoney(paidAmount * COMPANY_SHARE_RATIO);
    const companyShareRemaining = toMoney(Math.max(0, companyShareAmount - companySharePaid));

    return {
      uuid: item.uuid,
      installment_no: item.installment_no,
      due_date: item.due_date,
      amount: installmentAmount,
      paid_amount: paidAmount,
      status: item.status,
      company_share_amount: companyShareAmount,
      company_share_paid: companySharePaid,
      company_share_remaining: companyShareRemaining,
    };
  };

  const params = useParams<{ uuid?: string | string[] }>();
  const saleUuid = useMemo(() => {
    const raw = params?.uuid;
    if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
    return String(raw ?? "").trim();
  }, [params?.uuid]);

  const [sale, setSale] = useState<ApartmentSaleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [financial, setFinancial] = useState<ApartmentSaleFinancialRow | null>(null);
  const [financialForm, setFinancialForm] = useState<FinancialFormData>(createEmptyFinancialForm());
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialSaving, setFinancialSaving] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [municipalityLetter, setMunicipalityLetter] = useState<MunicipalityLetter | null>(null);
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [receiptRows, setReceiptRows] = useState<MunicipalityReceipt[]>([]);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptFormData>(createEmptyReceiptForm());
  const [companyInstallmentRows, setCompanyInstallmentRows] = useState<CompanyInstallmentPaymentRow[]>([]);
  const [companyInstallmentLoading, setCompanyInstallmentLoading] = useState(false);
  const [deedIssuing, setDeedIssuing] = useState(false);

  const loadSaleLocal = useCallback(async () => {
    if (!saleUuid) return null;
    const row = await apartmentSaleGetLocal(saleUuid);
    if (!row) return null;
    setSale(row);
    return row;
  }, [saleUuid]);

  const loadFinancialEditor = useCallback(async (options: { soft?: boolean } = {}) => {
    if (!saleUuid) return;
    const soft = options.soft ?? false;

    if (!soft) {
      setFinancialLoading(true);
      setLetterLoading(true);
      setReceiptLoading(true);
      setCompanyInstallmentLoading(true);
      setFinancialError(null);
      setLetterError(null);
      setReceiptError(null);
    }

    const financialPromise = apartmentSaleFinancialGetLocal(saleUuid)
      .then((row) => {
        if (!row) {
          setFinancial(null);
          setFinancialForm(createEmptyFinancialForm());
          return;
        }
        setFinancial(row);
        setFinancialForm(toFinancialForm(row));
      })
      .catch((error: unknown) => {
        setFinancial(null);
        setFinancialError(error instanceof Error ? error.message : "Failed to load sale financials.");
      })
      .finally(() => setFinancialLoading(false));

    const letterPromise = municipalityLetterGet(saleUuid)
      .then((letter) => setMunicipalityLetter(letter))
      .catch((error: unknown) => {
        setMunicipalityLetter(null);
        setLetterError(error instanceof Error ? error.message : "Failed to load municipality letter.");
      })
      .finally(() => setLetterLoading(false));

    const receiptPromise = municipalityReceiptList(saleUuid)
      .then((rows) => setReceiptRows(rows))
      .catch((error: unknown) => {
        setReceiptRows([]);
        setReceiptError(error instanceof Error ? error.message : "Failed to load municipality receipts.");
      })
      .finally(() => setReceiptLoading(false));

    const companyInstallmentPromise = (async () => {
      const allRows: InstallmentRow[] = [];
      let page = 1;
      while (true) {
        const local = await installmentsListLocal({ saleUuid, page, pageSize: 100 });
        allRows.push(...local.items);
        if (!local.hasMore) break;
        page += 1;
      }

      const rows = allRows
        .sort((a, b) => (a.installment_no ?? 0) - (b.installment_no ?? 0))
        .map(toCompanyInstallmentRow);
      setCompanyInstallmentRows(rows);
    })()
      .catch(() => setCompanyInstallmentRows([]))
      .finally(() => setCompanyInstallmentLoading(false));

    await Promise.all([financialPromise, letterPromise, receiptPromise, companyInstallmentPromise]);
  }, [saleUuid]);

  const refresh = useCallback(async () => {
    if (!saleUuid) {
      setLoadError("Sale uuid is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      try {
        await Promise.all([apartmentSalePullToLocal(), installmentsPullToLocal()]);
      } catch {}
      const row = await loadSaleLocal();
      if (!row) {
        setLoadError("Sale not found.");
        return;
      }
      await loadFinancialEditor();
    } finally {
      setLoading(false);
    }
  }, [loadFinancialEditor, loadSaleLocal, saleUuid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void (async () => {
        const row = await loadSaleLocal();
        if (!row) return;
        await loadFinancialEditor({ soft: true });
      })();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadFinancialEditor, loadSaleLocal]);

  const deedStatus = useMemo(() => String(sale?.deed_status ?? "not_issued").trim().toLowerCase(), [sale?.deed_status]);
  const deedIssuedAtLabel = useMemo(() => {
    if (!sale?.deed_issued_at || !Number.isFinite(sale.deed_issued_at)) return "-";
    return new Date(sale.deed_issued_at).toLocaleString();
  }, [sale?.deed_issued_at]);

  const deedBlockReason = useMemo(() => {
    if (!sale) return "Sale not found.";
    if (deedStatus === "issued") return "Ownership deed already issued.";
    if (String(sale.status ?? "").trim().toLowerCase() !== "completed") {
      return "Sale status must be completed before deed issuance.";
    }
    if (!financial) return "Financial breakdown is required.";
    if (financial.customer_debt > 0) return "Customer debt must be 0 before issuing deed.";
    if (financial.remaining_municipality > 0) return "Remaining municipality amount must be 0 before issuing deed.";
    return null;
  }, [deedStatus, financial, sale]);
  const canIssueDeed = !deedBlockReason;

  const handleFinancialSave = useCallback(async () => {
    if (!saleUuid || financialSaving) return;

    const deliveredToMunicipality = Number(financialForm.delivered_to_municipality || 0);
    const discountOrDeduction = Number(financialForm.discount_or_contractor_deduction || 0);

    if (!Number.isFinite(deliveredToMunicipality) || deliveredToMunicipality < 0) {
      setFinancialError("Delivered to municipality must be 0 or a positive number.");
      return;
    }
    if (!Number.isFinite(discountOrDeduction) || discountOrDeduction < 0) {
      setFinancialError("Discount/contractor deduction must be 0 or a positive number.");
      return;
    }

    setFinancialSaving(true);
    setFinancialError(null);
    try {
      const saved = await apartmentSaleFinancialUpdateLocal(saleUuid, {
        delivered_to_municipality: deliveredToMunicipality,
        discount_or_contractor_deduction: discountOrDeduction,
      });
      setFinancial(saved);
      setFinancialForm(toFinancialForm(saved));
      await loadSaleLocal();
      notifySuccess("Financial breakdown updated.");
    } catch (error: unknown) {
      setFinancialError(error instanceof Error ? error.message : "Failed to save sale financials.");
    } finally {
      setFinancialSaving(false);
    }
  }, [financialForm, financialSaving, loadSaleLocal, saleUuid]);

  const handleLetterGenerate = useCallback(async () => {
    if (!saleUuid) return;
    setLetterLoading(true);
    setLetterError(null);
    try {
      const letter = await municipalityLetterGenerate(saleUuid);
      setMunicipalityLetter(letter);
      notifySuccess("Municipality payment letter generated.");
    } catch (error: unknown) {
      setLetterError(error instanceof Error ? error.message : "Failed to generate municipality letter.");
    } finally {
      setLetterLoading(false);
    }
  }, [saleUuid]);

  const handleLetterPrint = useCallback(() => {
    if (!municipalityLetter?.printable_html) {
      setLetterError("Letter content is not available.");
      return;
    }
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setLetterError("Unable to open print window. Please allow popups and try again.");
      return;
    }
    popup.document.open();
    popup.document.write(municipalityLetter.printable_html);
    popup.document.close();
    popup.focus();
    popup.print();
  }, [municipalityLetter]);

  const handleReceiptSave = useCallback(async (): Promise<boolean> => {
    if (!saleUuid || receiptSaving) return false;
    const amount = Number(receiptForm.amount);
    const remainingMunicipality = Number(financial?.remaining_municipality ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setReceiptError("Receipt amount must be greater than 0.");
      return false;
    }
    if (!Number.isFinite(remainingMunicipality) || remainingMunicipality <= 0) {
      setReceiptError("Municipality share is already fully paid.");
      return false;
    }
    if (amount > remainingMunicipality) {
      setReceiptError(`Amount cannot exceed remaining municipality (${remainingMunicipality.toFixed(2)}).`);
      return false;
    }

    setReceiptSaving(true);
    setReceiptError(null);
    try {
      const saved = await municipalityReceiptCreate(saleUuid, {
        amount,
        payment_date: receiptForm.payment_date,
        payment_method: receiptForm.payment_method,
        receipt_no: receiptForm.receipt_no.trim() || undefined,
        notes: receiptForm.notes.trim() || undefined,
      });
      setReceiptRows((prev) => [saved.receipt, ...prev]);
      if (saved.financial) {
        setFinancial(saved.financial);
        setFinancialForm(toFinancialForm(saved.financial));
      } else {
        const localFinancial = await apartmentSaleFinancialGetLocal(saleUuid);
        if (localFinancial) {
          setFinancial(localFinancial);
          setFinancialForm(toFinancialForm(localFinancial));
        }
      }
      if (saved.letter) {
        setMunicipalityLetter(saved.letter);
      }
      setReceiptForm(createEmptyReceiptForm());
      await loadSaleLocal();
      notifySuccess("Municipality receipt saved.");
      return true;
    } catch (error: unknown) {
      setReceiptError(error instanceof Error ? error.message : "Failed to save municipality receipt.");
      return false;
    } finally {
      setReceiptSaving(false);
    }
  }, [financial?.remaining_municipality, loadSaleLocal, receiptForm, receiptSaving, saleUuid]);

  const handleIssueDeed = useCallback(async () => {
    if (!saleUuid || deedIssuing) return;
    setDeedIssuing(true);
    setFinancialError(null);
    try {
      const saved = await apartmentSaleIssueDeed(saleUuid);
      setSale(saved);
      await loadFinancialEditor();
      notifySuccess(`Ownership deed issued for ${saved.sale_id || saved.uuid}.`);
    } catch (error: unknown) {
      setFinancialError(error instanceof Error ? error.message : "Failed to issue ownership deed.");
    } finally {
      setDeedIssuing(false);
    }
  }, [deedIssuing, loadFinancialEditor, saleUuid]);

  return (
    <RequirePermission permission="sales.create">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Sale Financial Breakdown"
          subtitle={sale ? `Sale ${sale.sale_id || sale.uuid}` : "Manage municipality receipts and deed issuance"}
        >
          <div className="flex items-center gap-2">
            {sale && (
              <Link
                href={`/apartment-sales/${sale.uuid}/history`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                History
              </Link>
            )}
            <Link
              href="/apartment-sales"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Back To Sales
            </Link>
          </div>
        </PageHeader>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#12121a]">
            Loading financial page...
          </div>
        ) : loadError || !sale ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-500/30 dark:bg-[#12121a]">
            {loadError ?? "Sale not found."}
          </div>
        ) : (
          <ApartmentSaleFinancialPanel
            open
            financialLoading={financialLoading}
            financial={financial}
            financialForm={financialForm}
            financialSaving={financialSaving}
            financialError={financialError}
            onFinancialFormChange={setFinancialForm}
            onFinancialReset={() => {
              if (!financial) return;
              setFinancialForm(toFinancialForm(financial));
              setFinancialError(null);
            }}
            onFinancialSave={() => {
              void handleFinancialSave();
            }}
            deedStatus={deedStatus}
            deedIssuedAtLabel={deedIssuedAtLabel}
            saleLabel={sale.sale_id || sale.uuid}
            deedBlockReason={deedBlockReason}
            canIssueDeed={canIssueDeed}
            deedIssuing={deedIssuing}
            onIssueDeed={() => {
              void handleIssueDeed();
            }}
            showIssueDeedAction={false}
            municipalityLetter={municipalityLetter}
            letterLoading={letterLoading}
            letterError={letterError}
            onGenerateLetter={() => {
              void handleLetterGenerate();
            }}
            onPrintLetter={handleLetterPrint}
            receiptForm={receiptForm}
            receiptRows={receiptRows}
            receiptLoading={receiptLoading}
            receiptSaving={receiptSaving}
            receiptError={receiptError}
            onReceiptFormChange={setReceiptForm}
            onReceiptSave={handleReceiptSave}
            companyInstallmentRows={companyInstallmentRows}
            companyInstallmentLoading={companyInstallmentLoading}
          />
        )}
      </div>
    </RequirePermission>
  );
}
