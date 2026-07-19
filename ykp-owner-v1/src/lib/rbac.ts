/**
 * RBAC — owner layer needs only three roles, all read-only.
 * The app exposes no mutations at all; this gate exists so a stray
 * non-owner session (e.g. outlet_staff from HR) cannot enter.
 */
export type Role = 'owner' | 'super_admin' | 'viewer';

const ALLOWED: ReadonlySet<string> = new Set(['owner', 'super_admin', 'viewer']);

export function canView(role: string): boolean {
  return ALLOWED.has(role.toLowerCase());
}
