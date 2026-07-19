/**
 * RBAC for YKP Finance Module V1.
 * Roles per brief §9 + Revisi #26. finance_admin+ required for approvals.
 */
export type Role =
  | 'owner' | 'super_admin' | 'finance_admin' | 'brand_manager'
  | 'outlet_manager' | 'staff_input' | 'viewer';

export type Resource =
  | 'pos' | 'supplier_cost' | 'petty_cash' | 'expense' | 'closing_cash'
  | 'summary' | 'alert' | 'action' | 'threshold' | 'master'
  | 'dashboard' | 'analytics' | 'audit' | 'user' | 'telegram';

export type Action = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'generate' | 'import';

export function can(role: Role, action: Action, resource: Resource): boolean {
  if (role === 'owner') return true;
  const m = MATRIX[role];
  if (!m) return false;
  const a = m[resource];
  if (!a) return false;
  return a.includes(action);
}

/** Roles allowed to approve finance transactions (supplier payment, petty cash, expense). */
export function canApprove(role: Role): boolean {
  return role === 'owner' || role === 'super_admin' || role === 'finance_admin';
}

export function scopeFilter(
  role: Role,
  userBrandId?: string,
  userOutletId?: string
): { brandId?: string; outletId?: string } {
  if (role === 'owner' || role === 'super_admin' || role === 'finance_admin' || role === 'viewer') return {};
  if (role === 'brand_manager') return { brandId: userBrandId };
  if (role === 'outlet_manager' || role === 'staff_input') {
    return { brandId: userBrandId, outletId: userOutletId };
  }
  return {};
}

const V = ['view'] as Action[];
const VE = ['view', 'export'] as Action[];
const VC = ['view', 'create'] as Action[];
const WRITE: Action[] = ['view', 'create', 'update', 'export', 'import'];
const FULL: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'generate', 'import'];
const NO_DELETE: Action[] = ['view', 'create', 'update', 'approve', 'export', 'generate', 'import'];

const MATRIX: Partial<Record<Role, Partial<Record<Resource, Action[]>>>> = {
  owner: {
    pos: FULL, supplier_cost: FULL, petty_cash: FULL, expense: FULL, closing_cash: FULL,
    summary: FULL, alert: FULL, action: FULL, threshold: FULL, master: FULL,
    dashboard: FULL, analytics: FULL, audit: FULL, user: FULL, telegram: FULL
  },
  super_admin: {
    pos: FULL, supplier_cost: FULL, petty_cash: FULL, expense: FULL, closing_cash: FULL,
    summary: FULL, alert: FULL, action: FULL, threshold: FULL, master: FULL,
    dashboard: FULL, analytics: FULL, audit: FULL, user: FULL, telegram: FULL
  },
  finance_admin: {
    pos: FULL, supplier_cost: FULL, petty_cash: FULL, expense: FULL, closing_cash: FULL,
    summary: FULL, alert: NO_DELETE, action: NO_DELETE, threshold: NO_DELETE, master: WRITE,
    dashboard: VE, analytics: VE, audit: VE, user: V, telegram: VE
  },
  brand_manager: {
    pos: VE, supplier_cost: VE, petty_cash: WRITE, expense: WRITE, closing_cash: VC,
    summary: VE, alert: VE, action: VE, threshold: VE, master: V,
    dashboard: VE, analytics: VE, audit: V
  },
  outlet_manager: {
    pos: WRITE, supplier_cost: WRITE, petty_cash: WRITE, expense: WRITE, closing_cash: WRITE,
    summary: VE, alert: WRITE, action: WRITE, threshold: V, master: V,
    dashboard: VE, analytics: VE, audit: V
  },
  staff_input: {
    pos: VC, supplier_cost: VC, petty_cash: VC, expense: VC, closing_cash: VC,
    summary: V, alert: V, action: V, threshold: V, master: V,
    dashboard: V, analytics: V
  },
  viewer: {
    pos: V, supplier_cost: V, petty_cash: V, expense: V, closing_cash: V,
    summary: V, alert: V, action: V, threshold: V, master: V,
    dashboard: V, analytics: V
  }
};
