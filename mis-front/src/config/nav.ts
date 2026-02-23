import {
  LayoutDashboard,
  Building2,
} from 'lucide-react'

export const NAV_ITEMS = [
  // { label: "Dashboard", href: "/", icon: Home },
  { title: 'Overview', items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/' }] },
  {
    title: 'Property',
    items: [
      { icon: Building2, label: 'Apartments',permission: "apartments.view", path: '/apartments' },
      { icon: Building2, label: 'Customers',permission: "customers.view", path: '/customers' },

    ],
  },
];
