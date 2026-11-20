import { describe, expect, it } from 'vitest';
import { mergeSession, normalizeRole } from './session';

describe('ops session scope', () => {
  const token = { userId: 'USR-021', username: 'maya', role: 'staff', brandId: 'BR-OLD', outletId: 'OL-OLD' };

  it('maps super_admin to owner', () => {
    expect(normalizeRole('super_admin')).toBe('owner');
  });

  it('takes the current outlet from the user record', () => {
    expect(mergeSession(token, {
      user_id: 'USR-021',
      username: 'maya',
      role: 'staff',
      brand_id: 'BR-001',
      outlet_id: 'OL-011',
      active_status: 'active',
    })).toEqual({ userId: 'USR-021', username: 'maya', role: 'staff', brandId: 'BR-001', outletId: 'OL-011' });
  });

  it('rejects a deactivated account', () => {
    expect(mergeSession(token, { user_id: 'USR-021', role: 'staff', active_status: 'inactive' })).toBeNull();
  });
});
