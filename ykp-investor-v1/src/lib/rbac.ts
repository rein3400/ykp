/**
 * RBAC for Investor V1. Roles: owner, investor.
 * - owner: full access, can write capital/dividend/shareholding.
 * - investor: read-only dashboard, portfolio, returns.
 * No PII / HR / payroll / operational data exposed.
 */
export type Role = 'owner' | 'investor';
export type Resource = 'dashboard' | 'portfolio' | 'capital' | 'dividend' | 'returns' | 'master' | 'audit';
export type Action = 'view' | 'create' | 'update' | 'delete';

export function can(role: Role, action: Action, resource: Resource): boolean {
  if (role === 'owner') return true;
  // investor: read-only on portfolio/dashboard/returns only
  if (role === 'investor' && action === 'view') {
    return ['dashboard', 'portfolio', 'returns', 'master'].includes(resource);
  }
  return false;
}

export function isOwner(role: string): boolean {
  return role === 'owner';
}