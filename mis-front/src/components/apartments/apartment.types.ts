export type UsageType = "residential" | "commercial";
export type ApartmentStatus = "available" | "reserved" | "handed_over" | "sold" | "rented" | "company_use";
export type FormMode = "create" | "edit" | null;


export type ApartmentFormData = {
  apartment_code: string;
  usage_type: UsageType;
  block_number: string;
  unit_number: string;
  floor_number: string;
  bedrooms: number;
  halls: number;
  bathrooms: number;
  kitchens: number;
  balcony: "yes" | "no";
  area_sqm: string;
  apartment_shape: string;
  corridor: string;
  status: ApartmentStatus;
  qr_code: string;
  additional_info: string;
};

export const createEmptyApartmentForm = (): ApartmentFormData => ({
  apartment_code: "",
  usage_type: "residential",
  block_number: "",
  unit_number: "",
  floor_number: "",
  bedrooms: 0,
  halls: 0,
  bathrooms: 0,
  kitchens: 0,
  balcony: "no",
  area_sqm: "",
  apartment_shape: "",
  corridor: "",
  status: "available",
  qr_code: "",
  additional_info: "",
});
