import { describe, expect, it } from 'vitest';
import { can, scopeFilter } from './rbac';

describe('employee alias', () => {
  it('gives HR-synced employee accounts the staff permissions', () => {
    expect(can('employee', 'view', 'receiving')).toBe(true);
    expect(can('employee', 'create', 'receiving')).toBe(false);
  });

  it('scopes employee accounts to their outlet', () => {
    expect(scopeFilter('employee', 'BR-1', 'OL-1')).toEqual({ brandId: 'BR-1', outletId: 'OL-1' });
  });
});
