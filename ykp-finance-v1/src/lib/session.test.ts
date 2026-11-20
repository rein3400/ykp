import { describe, expect, it } from 'vitest';
import { mergeSession } from './session';

describe('finance session scope', () => {
  const token = { userId: 'U-9', username: 'lama', role: 'employee', brandId: 'BR-OLD', outletId: 'OL-OLD' };

  it('uses the current role and outlet from the user record', () => {
    expect(mergeSession(token, {
      user_id: 'U-9',
      username: 'staff_finance',
      role: 'finance_admin',
      brand_id: 'BR-001',
      outlet_id: 'OL-011',
      active_status: 'active',
    })).toEqual({ userId: 'U-9', username: 'staff_finance', role: 'finance_admin', brandId: 'BR-001', outletId: 'OL-011' });
  });

  it('drops a deactivated account', () => {
    expect(mergeSession(token, { user_id: 'U-9', role: 'employee', active_status: 'inactive' })).toBeNull();
  });
});
