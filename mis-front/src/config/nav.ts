import {
  LayoutDashboard,
  Building2,
  User
} from 'lucide-react'

export const NAV_ITEMS = [
  // { label: "Dashboard", href: "/", icon: Home },
  { title: 'Overview', items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/' }] },
  {
    title: 'User & Roles',
    items: [
      // { icon: Building2, label: 'Apartments',permission: "apartments.view", path: '/apartments' },
      { icon: User, label: 'Users', path: '/users' },
      { icon: User, label: 'User Roles', path: '/user-roles' },
    ],
  },
  {
    title: 'Property',
    items: [
      { icon: Building2, label: 'Apartments',permission: "apartments.view", path: '/apartments' },
      { icon: Building2, label: 'Customers',permission: "customers.view", path: '/customers' },
    ],
  },
];
