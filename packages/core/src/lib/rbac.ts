export const roles = ['admin', 'operator', 'viewer'] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  'execution:read',
  'execution:write',
  'event:read',
  'trace:read',
  'graph:read',
  'metric:read',
  'replay:write',
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(permissions),
  operator: new Set([
    'execution:read',
    'execution:write',
    'event:read',
    'trace:read',
    'graph:read',
    'metric:read',
    'replay:write',
  ]),
  viewer: new Set(['execution:read', 'event:read', 'trace:read', 'graph:read', 'metric:read']),
};

export type Principal = {
  sub?: string;
  tenantId?: string;
  role?: Role;
  permissions?: Permission[];
  denied?: boolean;
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}

export function can(principal: Principal | null | undefined, permission: Permission): boolean {
  if (!principal || principal.denied) return false;
  if (principal.permissions?.includes(permission)) return true;
  const role = isRole(principal.role) ? principal.role : 'viewer';
  return rolePermissions[role].has(permission);
}
