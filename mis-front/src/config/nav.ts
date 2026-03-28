import {
  LayoutDashboard,
  Building2,
  User,
  ShieldCheck,
  UserCheck,
  BadgeDollarSign,
  CalendarCheck,
  MessageSquareText,
  KeyRound,
  FolderOpen,
  Boxes,
  ClipboardList,
  PackageCheck,
  FolderKanban,
  ArrowLeftRight,
} from 'lucide-react'

export const NAV_ITEMS = [
  // { label: "Dashboard", href: "/", icon: Home },
  { title: 'Overview', items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/' }] },
  {
    title: 'User & Roles',
    items: [
      // { icon: Building2, label: 'Apartm ents',permission: "apartments.view", path: '/apartments' },
      { icon: User, label: 'Users', path: '/users' },
      { icon: ShieldCheck, label: 'User Roles', path: '/user-roles' },
    ],
  },
  {
    title: 'HR & Employee',
    items: [
      { icon: Building2, label: 'Employees',permission: "employees.view", path: '/employees' },
      { icon: BadgeDollarSign, label: 'Payroll', permission: "payroll.view", path: '/payroll' },
    ],
  },
  {
    title: 'Apartment',
    items: [
      { icon: Building2, label: 'Apartments',permission: "apartments.view", path: '/apartments' },
      { icon: UserCheck, label: 'Customers',permission: "customers.view", path: '/customers' },
      { icon: BadgeDollarSign, label: 'Sales',permission: "sales.create", path: '/apartment-sales' },
      { icon: CalendarCheck, label: 'Installments',permission: "installments.pay", path: '/installments' },
      { icon: MessageSquareText, label: 'CRM', permission: "customers.view", path: '/crm' },
      { icon: FolderOpen, label: 'Documents', path: '/documents' },
    ],
  },
  {
    title: 'INVENTORY & ASSETS',
    items: [
      { icon: FolderKanban, label: 'Projects', permission: "inventory.request", path: '/projects' },
      { icon: Boxes, label: 'Master Data', permission: "inventory.request", path: '/inventories' },
      { icon: ClipboardList, label: 'Material Requests', permission: "inventory.request", path: '/inventory-requests' },
      { icon: PackageCheck, label: 'Asset Requests', permission: "inventory.request", path: '/asset-requests' },
      { icon: ArrowLeftRight, label: 'Movement History', permission: "inventory.request", path: '/inventory-movements' },
    ],
  },

  {
    title: 'Rental Apartment',
    items: [
      { icon: KeyRound, label: 'Rentals', permission: "apartments.view", path: '/rentals' },
      { icon: BadgeDollarSign, label: 'Rental Payments', permission: "apartments.view", path: '/rental-payments' },
    ],
  },
];
