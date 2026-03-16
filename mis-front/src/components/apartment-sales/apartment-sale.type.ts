export type FormMode = "create" | "edit" | null;

export type PaymentType = "full" | "installment";
export type SaleStatus = "active" | "pending" | "approved" | "completed" | "cancelled" | "defaulted" | "terminated";
export type InstallmentFrequency = "weekly" | "monthly" | "quarterly" | "custom_dates";

export type ApartmentSaleCustomDate = {
  installment_no: number;
  due_date: string;
  amount: string;
};

export type ApartmentSaleFormData = {
  customer_id: string;
  apartment_id: string;
  sale_date: string;
  total_price: string;
  discount: string;
  payment_type: PaymentType;
  status: SaleStatus;
  frequency_type: InstallmentFrequency;
  installment_count: string;
  first_due_date: string;
  schedule_locked: boolean;
  custom_dates: ApartmentSaleCustomDate[];
};

const today = () => new Date().toISOString().slice(0, 10);

export const statusFromPaymentType = (paymentType: PaymentType): SaleStatus =>
  paymentType === "installment" ? "active" : "pending";

export const createEmptyApartmentSaleForm = (): ApartmentSaleFormData => ({
  customer_id: "",
  apartment_id: "",
  sale_date: today(),
  total_price: "",
  discount: "0",
  payment_type: "full",
  status: statusFromPaymentType("full"),
  frequency_type: "monthly",
  installment_count: "",
  first_due_date: today(),
  schedule_locked: false,
  custom_dates: [],
});
