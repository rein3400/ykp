import { describe, expect, it } from 'vitest';
import { mergeSession, normalizeRole } from './session';

describe('session role mapping', () => {
  it('treats an employee account as staff', () => {
    expect(normalizeRole('employee')).toBe('staff');
  });

  it('lowercases and keeps known roles', () => {
    expect(normalizeRole('Outlet_Manager')).toBe('outlet_manager');
  });
});

describe('mergeSession', () => {
  const token = { userId: 'U-1', username: 'lama', role: 'employee', brandId: 'BR-OLD', outletId: 'OL-OLD', exp: 9999999999 };

  it('uses the current user record so a changed outlet is not stale', () => {
    const merged = mergeSession(token, {
      user_id: 'U-1',
      username: 'tadris',
      role: 'employee',
      brand_id: 'BR-003',
      outlet_id: 'OL-013',
      active_status: 'active',
    });
    expect(merged).toEqual({ userId: 'U-1', username: 'tadris', role: 'staff', brandId: 'BR-003', outletId: 'OL-013' });
  });

  it('logs out a user that was deactivated after login', () => {
    expect(mergeSession(token, { user_id: 'U-1', role: 'staff', active_status: 'inactive' })).toBeNull();
  });

  it('keeps the token when there is no user record (hub SSO)', () => {
    const merged = mergeSession(token, null);
    expect(merged?.role).toBe('staff');
    expect(merged?.outletId).toBe('OL-OLD');
  });
});
