"use client";

import { Badge } from "@/components/ui/Badge";
import type { Column } from "@/components/ui/DataTable";
import { ApartmentSaleRow } from "@/db/localDB";

type SaleStatus = "active" | "pending" | "approved" | "completed" | "cancelled" | "defaulted" | "terminated";

const statusColor: Record<SaleStatus, "blue" | "purple" | "amber" | "emerald" | "red"> = {
  active: "blue",
  pending: "amber",
  approved: "purple",
  completed: "emerald",
  cancelled: "red",
  defaulted: "red",
  terminated: "red",
};

const normalizeStatus = (status: string): SaleStatus => {
  const value = status.trim().toLowerCase();
  if (value === "pending" || value === "approved" || value === "completed" || value === "cancelled" || value === "defaulted" || value === "terminated") return value;
  return "active";
};

const money = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
};

type SalesColumnOptions = {
  customerLabelById?: ReadonlyMap<number, string>;
  apartmentLabelById?: ReadonlyMap<number, string>;
  onPrintSale?: (row: ApartmentSaleRow) => void;
  onPrintDeed?: (row: ApartmentSaleRow) => void;
  onIssueDeed?: (row: ApartmentSaleRow) => void;
  canIssueDeed?: boolean;
  municipalityRemainingBySaleUuid?: ReadonlyMap<string, number>;
  installmentPaidBySaleUuid?: ReadonlyMap<string, number>;
  canManageSales?: boolean;
  canApproveSale?: boolean;
  onApproveSale?: (row: ApartmentSaleRow) => void;
  onRejectSale?: (row: ApartmentSaleRow) => void;
  onHandoverKey?: (row: ApartmentSaleRow) => void;
  onTerminate?: (row: ApartmentSaleRow) => void;
};

export function createApartmentSalesColumns(options: SalesColumnOptions = {}): Column<ApartmentSaleRow>[] {
  const customerLabelById = options.customerLabelById;
  const apartmentLabelById = options.apartmentLabelById;
  const onPrintSale = options.onPrintSale;
  const onPrintDeed = options.onPrintDeed;
  const onIssueDeed = options.onIssueDeed;
  const canIssueDeed = Boolean(options.canIssueDeed && onIssueDeed);
  const municipalityRemainingBySaleUuid = options.municipalityRemainingBySaleUuid;
  const installmentPaidBySaleUuid = options.installmentPaidBySaleUuid;
  const canManageSales = Boolean(options.canManageSales);
  const canApproveSale = Boolean(options.canApproveSale && options.onApproveSale);
  const onApproveSale = options.onApproveSale;
  const onRejectSale = options.onRejectSale;
  const onHandoverKey = options.onHandoverKey;
  const onTerminate = options.onTerminate;

  const toNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const paidAmount = (item: ApartmentSaleRow): number => {
    const fromMap = installmentPaidBySaleUuid?.get(item.uuid);
    if (typeof fromMap === "number" && Number.isFinite(fromMap)) {
      return Math.max(0, toNumber(fromMap));
    }
    const customerReceivable = Math.max(
      0,
      toNumber((item.net_price ?? toNumber(item.total_price) - toNumber(item.discount)) ?? 0) * 0.85
    );
    if (item.payment_type !== "installment" && Number(item.installments_count ?? 0) <= 0) {
      return normalizeStatus(item.status) === "completed"
        ? Math.max(0, customerReceivable)
        : 0;
    }
    return Math.max(0, toNumber(item.installments_paid_total));
  };

  const remainingAmount = (item: ApartmentSaleRow): number => {
    const net = toNumber(item.net_price ?? toNumber(item.total_price) - toNumber(item.discount));
    const customerReceivable = Math.max(0, net * 0.85);
    const status = normalizeStatus(item.status);
    if (status === "terminated" || status === "defaulted") {
      return Math.max(0, toNumber(item.remaining_debt_after_termination));
    }
    if (item.payment_type !== "installment" && Number(item.installments_count ?? 0) <= 0) {
      return status === "completed" ? 0 : Math.max(0, customerReceivable);
    }
    return Math.max(0, customerReceivable - paidAmount(item));
  };

  const columns: Column<ApartmentSaleRow>[] = [
    {
      key: "sale_id",
      label: "Sale ID",
      render: (item) => <span className="font-semibold">{item.sale_id || item.uuid.slice(0, 8).toUpperCase()}</span>,
    },
    {
      key: "customer_id",
      label: "Customer",
      render: (item) => (
        <span className="font-semibold">
          {customerLabelById?.get(item.customer_id) ?? `Customer #${item.customer_id}`}
        </span>
      ),
    },
    {
      key: "apartment_id",
      label: "Apartment",
      render: (item) => (
        <span className="font-semibold">
          {apartmentLabelById?.get(item.apartment_id) ?? `Apartment #${item.apartment_id}`}
        </span>
      ),
    },
    {
      key: "amounts",
      label: "Amounts",
      render: (item) => (
        <div className="leading-5">
          <div>{money(item.total_price)}</div>
          <div className="text-xs text-slate-500">{`Net: ${money((item.net_price ?? item.total_price - item.discount) || 0)}`}</div>
        </div>
      ),
    },
    {
      key: "sale_print",
      label: "Print",
      render: (item) => (
        <button
          type="button"
          onClick={() => onPrintSale?.(item)}
          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
        >
          Print PDF
        </button>
      ),
    },
    {
      key: "payment_type",
      label: "Payment",
      render: (item) => {
        const isInstallment = item.payment_type === "installment";
        const count = item.installment_count ? ` x${item.installment_count}` : "";

        return (
          <div className="leading-5">
            <Badge color={isInstallment ? "amber" : "blue"}>{item.payment_type || "full"}</Badge>
            {isInstallment && <div className="mt-1 text-xs text-slate-500">{`${item.frequency_type ?? "monthly"}${count}`}</div>}
          </div>
        );
      },
    },
      {
        key: "status",
        label: "Status",
        render: (item) => {
          const status = normalizeStatus(item.status);
          return (
            <div className="space-y-1">
              <Badge color={statusColor[status]}>{status}</Badge>
              {status === "pending" && canApproveSale && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApproveSale?.(item)}
                    className="inline-flex items-center rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    Approve Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectSale?.(item)}
                    className="inline-flex items-center rounded-lg border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-50"
                  >
                    Reject Sale
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
    {
      key: "possession",
      label: "Possession",
      render: (item) => {
        const status = normalizeStatus(item.status);
        const terminal = status === "cancelled" || status === "terminated" || status === "defaulted";
        const handoverStatus = String(item.key_handover_status ?? "not_handed_over").trim().toLowerCase();
        const hasInstallmentPayment = item.payment_type === "installment" && paidAmount(item) > 0;
        const canHandover = Boolean(item.can_handover_key || item.has_first_installment_paid || hasInstallmentPayment);
        const showHandoverBadge = handoverStatus === "handed_over" || handoverStatus === "returned";
        const possessionLabel = handoverStatus === "handed_over" ? "handed over" : "returned";
        const possessionColor = handoverStatus === "handed_over" ? "emerald" : "purple";

        return (
          <div className="space-y-1">
            {showHandoverBadge && <Badge color={possessionColor}>{possessionLabel}</Badge>}
            {canManageSales && onHandoverKey && handoverStatus !== "handed_over" && (
              <button
                type="button"
                disabled={!canHandover || terminal}
                onClick={() => onHandoverKey(item)}
                className="inline-flex items-center rounded-lg border border-blue-300 px-2 py-1 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Handover Key
              </button>
            )}
            {canManageSales && onTerminate && !terminal && status !== "completed" && (
              <button
                type="button"
                disabled={String(item.deed_status ?? "").trim().toLowerCase() === "issued"}
                onClick={() => onTerminate(item)}
                className="inline-flex items-center rounded-lg border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Terminate
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "deed_action",
      label: "Deed",
      render: (item) => {
        const issued = String(item.deed_status ?? "").trim().toLowerCase() === "issued";
        const rawRemaining = municipalityRemainingBySaleUuid?.get(item.uuid);
        const hasRemainingValue = typeof rawRemaining === "number" && Number.isFinite(rawRemaining);
        const municipalityRemaining = hasRemainingValue
          ? Math.max(0, toNumber(rawRemaining))
          : Number.POSITIVE_INFINITY;
        const municipalityDone = hasRemainingValue && municipalityRemaining <= 0;
        const customerRemaining = remainingAmount(item);
        const customerDone = customerRemaining <= 0;
        const status = normalizeStatus(item.status);
        const terminal = status === "cancelled" || status === "terminated" || status === "defaulted";

        if (issued) {
          return (
            <div className="space-y-2 leading-5">
              <Badge color="emerald">issued</Badge>
              {onPrintDeed && (
                <button
                  type="button"
                  onClick={() => onPrintDeed(item)}
                  className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                >
                  Print Deed
                </button>
              )}
            </div>
          );
        }

        if (!canIssueDeed) {
          return (
            <div className="leading-5">
              <Badge color="amber">not issued</Badge>
              <div className="text-xs text-slate-500">view only</div>
            </div>
          );
        }

        return (
          <div className="leading-5">
            <button
              type="button"
              disabled={!municipalityDone || !customerDone || terminal}
              onClick={() => onIssueDeed?.(item)}
              className="inline-flex items-center rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Issue Deed
            </button>
          </div>
        );
      },
    },
  ];

  return columns;
}
