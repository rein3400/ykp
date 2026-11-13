import { describe, expect, it } from 'vitest';
import { can, type Role } from './rbac';

const DENIED: Role[] = ['super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee', 'viewer'];

describe('payroll-adjacent resource policy', () => {
  it.each(DENIED)('denies %s any payroll or adjustment action', (role) => {
    for (const action of ['view', 'create', 'update', 'approve', 'export', 'generate', 'mark_paid'] as const) {
      expect(can(role, action, 'payroll'), `${role} ${action} payroll`).toBe(false);
      expect(can(role, action, 'adjustment'), `${role} ${action} adjustment`).toBe(false);
    }
  });

  it('allows owner every payroll and adjustment action', () => {
    for (const action of ['view', 'create', 'update', 'approve', 'export', 'generate', 'mark_paid'] as const) {
      expect(can('owner', action, 'payroll'), `owner ${action} payroll`).toBe(true);
      expect(can('owner', action, 'adjustment'), `owner ${action} adjustment`).toBe(true);
    }
  });

  it('allows finance_admin to read and approve payroll adjustments', () => {
    expect(can('finance_admin', 'view', 'adjustment')).toBe(true);
    expect(can('finance_admin', 'approve', 'adjustment')).toBe(true);
    expect(can('finance_admin', 'view', 'payroll')).toBe(true);
  });

  it('keeps non-payroll resources reachable for hr_admin', () => {
    expect(can('hr_admin', 'view', 'employee')).toBe(true);
    expect(can('hr_admin', 'approve', 'leave')).toBe(true);
  });
});
