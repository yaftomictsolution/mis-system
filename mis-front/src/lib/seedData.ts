import { db } from "@/db/localDB";

const SEED_KEY = "seed_initialized_v1";

export function isSeedInitialized(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SEED_KEY) === "true";
}

export function markSeedInitialized(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEED_KEY, "true");
}

const DEFAULT_ROLES = [
  {
    uuid: "role-admin-001",
    name: "Admin",
    guard_name: "web",
    permissions: [
      "users.view", "users.create", "users.edit", "users.delete",
      "roles.view", "roles.create", "roles.edit", "roles.delete",
      "customers.view", "customers.create", "customers.edit", "customers.delete",
      "apartments.view", "apartments.create", "apartments.edit", "apartments.delete",
      "sales.view", "sales.create", "sales.edit", "sales.delete",
      "installments.view", "installments.create", "installments.edit", "installments.delete",
      "reports.view", "reports.export",
    ],
    updated_at: Date.now(),
  },
  {
    uuid: "role-manager-001",
    name: "Manager",
    guard_name: "web",
    permissions: [
      "customers.view", "customers.create", "customers.edit",
      "apartments.view", "apartments.create", "apartments.edit",
      "sales.view", "sales.create", "sales.edit",
      "installments.view", "installments.create", "installments.edit",
      "reports.view", "reports.export",
    ],
    updated_at: Date.now(),
  },
  {
    uuid: "role-staff-001",
    name: "Staff",
    guard_name: "web",
    permissions: [
      "customers.view", "customers.create",
      "apartments.view",
      "sales.view",
      "installments.view",
      "reports.view",
    ],
    updated_at: Date.now(),
  },
  {
    uuid: "role-customer-001",
    name: "Customer",
    guard_name: "web",
    permissions: [
      "my.apartments.view",
      "my.installments.view",
      "my.payments.view",
    ],
    updated_at: Date.now(),
  },
];

const DEFAULT_USERS = [
  {
    uuid: "user-admin-001",
    name: "System Administrator",
    password: "",
    roles: ["Admin"],
    email: "admin@example.com",
    customer_id: null,
    customer_uuid: null,
    customer_name: null,
    updated_at: Date.now(),
  },
  {
    uuid: "user-manager-001",
    name: "Default Manager",
    password: "",
    roles: ["Manager"],
    email: "manager@example.com",
    customer_id: null,
    customer_uuid: null,
    customer_name: null,
    updated_at: Date.now(),
  },
  {
    uuid: "user-staff-001",
    name: "Default Staff",
    password: "",
    roles: ["Staff"],
    email: "staff@example.com",
    customer_id: null,
    customer_uuid: null,
    customer_name: null,
    updated_at: Date.now(),
  },
];

export async function seedDefaultData(): Promise<void> {
  if (isSeedInitialized()) {
    const rolesCount = await db.roles.count();
    console.log("[Seed] Already initialized, roles in DB:", rolesCount);
    return;
  }

  try {
    const existingRoles = await db.roles.count();
    console.log("[Seed] Existing roles count:", existingRoles);
    
    if (existingRoles === 0) {
      console.log("[Seed] Seeding default roles...");
      await db.roles.bulkPut(DEFAULT_ROLES);
      const afterRolesCount = await db.roles.count();
      console.log("[Seed] Roles after seeding:", afterRolesCount);
      localStorage.setItem("roles_options_keys", JSON.stringify(DEFAULT_ROLES.map((r) => r.name)));
    }

    const existingUsers = await db.users.count();
    console.log("[Seed] Existing users count:", existingUsers);
    
    if (existingUsers === 0) {
      await db.users.bulkPut(DEFAULT_USERS);
    }

    markSeedInitialized();
    console.log("[Seed] Seed completed and marked as initialized");
  } catch (error) {
    console.error("[Seed] Failed to seed default data:", error);
  }
}

export async function clearAndReseed(): Promise<void> {
  await db.users.clear();
  await db.roles.clear();
  localStorage.removeItem(SEED_KEY);
  localStorage.removeItem("roles_options_keys");
  await seedDefaultData();
}
