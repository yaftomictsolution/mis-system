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
    title: 'Rental Apartment',
    items: [
      { icon: KeyRound, label: 'Rentals', permission: "apartments.view", path: '/rentals' },
      { icon: BadgeDollarSign, label: 'Rental Payments', permission: "apartments.view", path: '/rental-payments' },
    ],
  },
];
