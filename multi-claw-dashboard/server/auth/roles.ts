export const ROLES = {
  admin: { level: 3, canManageUsers: true, canManageAgents: true, canExecuteTasks: true },
  operator: { level: 2, canManageUsers: false, canManageAgents: true, canExecuteTasks: true },
  viewer: { level: 1, canManageUsers: false, canManageAgents: false, canExecuteTasks: false },
  agent: { level: 2, canManageUsers: false, canManageAgents: false, canExecuteTasks: true },
} as const;
export type Role = keyof typeof ROLES;
export function hasPermission(role: Role, permission: keyof (typeof ROLES)["admin"]): boolean {
  return !!(ROLES[role]?.[permission] ?? false);
}
