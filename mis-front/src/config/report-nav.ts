import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  FolderKanban,
  KeyRound,
  MessageSquareText,
  PackageCheck,
  ShoppingCart,
  User,
  UserCheck,
  Wallet,
} from "lucide-react";

import type { PermissionRequirement, RoleRequirement } from "@/lib/permissions";
import type { ReportKey } from "@/modules/reports/reports.types";

export type ReportDefinition = {
  key: ReportKey;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission?: PermissionRequirement;
  role?: RoleRequirement;
  accentFrom: string;
  accentTo: string;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "apartments",
    label: "Apartment Reports",
    description: "Availability, block summaries, and apartment status tracking.",
    path: "/reports/apartments",
    icon: Building2,
    permission: "apartments.view",
    accentFrom: "#0f766e",
    accentTo: "#14b8a6",
  },
  {
    key: "customers",
    label: "Customer Reports",
    description: "Customer activity, representative coverage, and region breakdowns.",
    path: "/reports/customers",
    icon: UserCheck,
    permission: "customers.view",
    accentFrom: "#2563eb",
    accentTo: "#60a5fa",
  },
  {
    key: "sales",
    label: "Sales Reports",
    description: "Apartment sale totals, remaining balances, and payment mix.",
    path: "/reports/sales",
    icon: BadgeDollarSign,
    permission: ["sales.create", "sales.approve"],
    accentFrom: "#c2410c",
    accentTo: "#fb923c",
  },
  {
    key: "installments",
    label: "Installment Reports",
    description: "Scheduled, overdue, and paid installment performance.",
    path: "/reports/installments",
    icon: CalendarCheck,
    permission: ["installments.pay", "sales.create", "sales.approve"],
    accentFrom: "#7c3aed",
    accentTo: "#a78bfa",
  },
  {
    key: "documents",
    label: "Document Reports",
    description: "Document volume, module usage, and pending offline uploads.",
    path: "/reports/documents",
    icon: FileText,
    permission: "customers.view",
    accentFrom: "#0f766e",
    accentTo: "#34d399",
  },
  {
    key: "crm",
    label: "CRM Reports",
    description: "Communication history, reminder delivery, and message status.",
    path: "/reports/crm",
    icon: MessageSquareText,
    permission: "customers.view",
    accentFrom: "#334155",
    accentTo: "#64748b",
  },
  {
    key: "employees",
    label: "Employee Reports",
    description: "Team size, status, salaries, and hiring visibility.",
    path: "/reports/employees",
    icon: User,
    permission: "employees.view",
    accentFrom: "#4338ca",
    accentTo: "#818cf8",
  },
  {
    key: "payroll",
    label: "Payroll Reports",
    description: "Gross, tax, and net salary payment reporting.",
    path: "/reports/payroll",
    icon: Wallet,
    permission: "payroll.view",
    accentFrom: "#047857",
    accentTo: "#10b981",
  },
  {
    key: "accounts",
    label: "Account Reports",
    description: "Account balances, inflow-outflow activity, and transaction history.",
    path: "/reports/accounts",
    icon: BadgeDollarSign,
    permission: "accounts.view",
    accentFrom: "#1d4ed8",
    accentTo: "#38bdf8",
  },
  {
    key: "projects",
    label: "Project Reports",
    description: "Project status, timelines, and assigned employee visibility.",
    path: "/reports/projects",
    icon: FolderKanban,
    permission: ["projects.view", "inventory.request"],
    accentFrom: "#4f46e5",
    accentTo: "#a78bfa",
  },
  {
    key: "inventory",
    label: "Inventory Reports",
    description: "Movement trends, stock flow, and warehouse activity.",
    path: "/reports/inventory",
    icon: Boxes,
    permission: ["stock_movements.view", "inventory.request"],
    accentFrom: "#0f766e",
    accentTo: "#2dd4bf",
  },
  {
    key: "material-requests",
    label: "Material Request Reports",
    description: "Request approvals, issue quantities, and project demand.",
    path: "/reports/material-requests",
    icon: ClipboardList,
    permission: ["material_requests.view", "inventory.request"],
    accentFrom: "#a16207",
    accentTo: "#f59e0b",
  },
  {
    key: "purchase-requests",
    label: "Purchase Request Reports",
    description: "Purchase approvals, finance processing, and receipts.",
    path: "/reports/purchase-requests",
    icon: ShoppingCart,
    permission: ["purchase_requests.view", "inventory.request", "purchase_requests.finance", "purchase_requests.receive"],
    accentFrom: "#b91c1c",
    accentTo: "#fb7185",
  },
  {
    key: "asset-requests",
    label: "Asset Request Reports",
    description: "Asset request approvals, allocations, and quantity summaries.",
    path: "/reports/asset-requests",
    icon: PackageCheck,
    permission: ["asset_requests.view", "inventory.request"],
    accentFrom: "#6d28d9",
    accentTo: "#c084fc",
  },
  {
    key: "rentals",
    label: "Rental Reports",
    description: "Rental contracts, approval queue, and occupancy progress.",
    path: "/reports/rentals",
    icon: KeyRound,
    permission: "apartments.view",
    accentFrom: "#0f766e",
    accentTo: "#22c55e",
  },
  {
    key: "rental-payments",
    label: "Rental Payment Reports",
    description: "Bills, collections, outstanding rent, and payment status.",
    path: "/reports/rental-payments",
    icon: ArrowLeftRight,
    permission: ["installments.pay", "sales.approve", "accounts.view", "apartments.view"],
    role: ["Admin", "Accountant", "Finance", "FinanceManager", "Finance Manager"],
    accentFrom: "#0369a1",
    accentTo: "#22d3ee",
  },
];

export const REPORT_DEFINITION_MAP = REPORT_DEFINITIONS.reduce<Record<ReportKey, ReportDefinition>>(
  (map, definition) => {
    map[definition.key] = definition;
    return map;
  },
  {} as Record<ReportKey, ReportDefinition>
);
