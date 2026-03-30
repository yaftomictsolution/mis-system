export type PermissionRequirement = string | string[];
export type RoleRequirement = string | string[];

export function hasAnyPermission(
  permissions: string[] = [],
  requirement?: PermissionRequirement | null,
): boolean {
  if (!requirement) return true;

  const required = Array.isArray(requirement) ? requirement : [requirement];
  if (!required.length) return true;

  return required.some((permission) => permissions.includes(permission));
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase();
}

export function hasAnyRole(
  roles: string[] = [],
  requirement?: RoleRequirement | null,
): boolean {
  if (!requirement) return true;

  const required = (Array.isArray(requirement) ? requirement : [requirement])
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  if (!required.length) return true;

  const normalizedRoles = roles.map((role) => normalizeRole(role)).filter(Boolean);
  return required.some((role) => normalizedRoles.includes(role));
}

export function isAdminRole(roles: string[] = []): boolean {
  return hasAnyRole(roles, "Admin");
}
