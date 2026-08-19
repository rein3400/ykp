/**
 * RBAC matrix per brief §9. Roles:
 *   owner, super_admin, hr_admin, finance_admin, brand_manager, outlet_manager,
 *   supervisor, employee, viewer
 *
 * Resources: employee, attendance, roster, leave, lateness, payroll, adjustment,
 *            summary, audit, user, rule, master.
 * Actions: view, create, update, delete, approve, export, generate, mark_paid.
 *
 * scope: brand/outlet filtering. brand_manager → own brand. outlet_manager/supervisor → own outlet.
 * employee → self only.
 */

export type Role =
  | 'owner'
  | 'super_admin'
  | 'hr_admin'
  | 'finance_admin'
  | 'brand_manager'
  | 'outlet_manager'
  | 'supervisor'
  | 'employee'
  | 'viewer';

export type Resource =
  | 'employee'
  | 'attendance'
  | 'roster'
  | 'leave'
  | 'lateness'
  | 'payroll'
  | 'adjustment'
  | 'summary'
  | 'audit'
  | 'user'
  | 'rule'
  | 'master';

export type Action =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'generate'
  | 'mark_paid';

/** Returns true if role can do action on resource. Scope filtering handled by caller. */
export function can(role: Role, action: Action, resource: Resource): boolean {
  // Owner has full access to everything (wildcard).
  if (role === 'owner') return true;
  const m = MATRIX[role];
  if (!m) return false;
  const a = m[resource];
  if (!a) return false;
  return a.includes(action);
}

/** Scope filter: which brand/outlet ids the user can see. owner/super_admin = all (undefined). */
export function scopeFilter(role: Role, userBrandId?: string, userOutletId?: string): { brandId?: string; outletId?: string; selfOnly: boolean } {
  if (role === 'owner' || role === 'super_admin' || role === 'hr_admin') return { selfOnly: false };
  if (role === 'finance_admin') return { selfOnly: false };
  if (role === 'brand_manager') return { brandId: userBrandId, selfOnly: false };
  if (role === 'outlet_manager' || role === 'supervisor') return { brandId: userBrandId, outletId: userOutletId, selfOnly: false };
  if (role === 'employee') return { brandId: userBrandId, outletId: userOutletId, selfOnly: true };
  if (role === 'viewer') return { selfOnly: false };
  return { selfOnly: true };
}

const ALL: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'generate', 'mark_paid'];

const MATRIX: Partial<Record<Role, Partial<Record<Resource, Action[]>>>> = {
  owner: {
    employee: ['view', 'export'],
    attendance: ['view', 'export'],
    roster: ['view', 'export'],
    leave: ['view', 'approve', 'export'],
    lateness: ['view', 'approve', 'export'],
    payroll: ['view', 'approve', 'export', 'mark_paid'],
    adjustment: ['view', 'approve', 'export'],
    summary: ['view', 'export'],
    audit: ['view', 'export'],
    user: ['view'],
    rule: ['view'],
    master: ['view']
  },
  super_admin: {
    employee: ALL,
    attendance: ALL,
    roster: ALL,
    leave: ALL,
    lateness: ALL,
    payroll: ALL,
    adjustment: ALL,
    summary: ALL,
    audit: ['view', 'export'],
    user: ALL,
    rule: ALL,
    master: ALL
  },
  hr_admin: {
    employee: ['view', 'create', 'update', 'export'],
    attendance: ['view', 'create', 'update', 'export'],
    roster: ['view', 'create', 'update', 'export'],
    leave: ['view', 'approve', 'export'],
    lateness: ['view', 'create', 'update', 'approve', 'export'],
    payroll: ['view', 'generate', 'export'],
    adjustment: ['view', 'create', 'update', 'export'],
    summary: ['view', 'generate', 'export'],
    audit: ['view'],
    rule: ['view', 'create', 'update'],
    master: ['view', 'create', 'update'],
    user: ['view', 'create', 'update']
  },
  finance_admin: {
    payroll: ['view', 'export', 'mark_paid'],
    summary: ['view', 'export'],
    audit: ['view']
  },
  brand_manager: {
    employee: ['view', 'export'],
    attendance: ['view', 'export'],
    roster: ['view', 'approve', 'export'],
    leave: ['view', 'approve', 'export'],
    lateness: ['view', 'export'],
    payroll: ['view'],
    summary: ['view', 'export']
  },
  outlet_manager: {
    employee: ['view'],
    attendance: ['view', 'update', 'create', 'export'],
    roster: ['view', 'create', 'update', 'approve', 'export'],
    leave: ['view', 'approve', 'export'],
    lateness: ['view', 'export'],
    summary: ['view', 'export']
  },
  supervisor: {
    employee: ['view'],
    attendance: ['view', 'create', 'update'],
    roster: ['view', 'create', 'update'],
    leave: ['view', 'approve'],
    lateness: ['view']
  },
  employee: {
    attendance: ['view', 'create'], // self check-in/out only
    roster: ['view'],
    leave: ['view', 'create'],
    payroll: ['view']
  },
  viewer: {
    employee: ['view'],
    attendance: ['view'],
    roster: ['view'],
    summary: ['view'],
    audit: ['view']
  }
};