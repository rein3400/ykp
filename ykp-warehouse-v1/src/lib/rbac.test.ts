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

describe('outlet manager master edits', () => {
  it('can edit items and suppliers but not archive them', () => {
    expect(can('outlet_manager', 'update', 'item')).toBe(true);
    expect(can('outlet_manager', 'update', 'supplier')).toBe(true);
    expect(can('outlet_manager', 'delete', 'item')).toBe(false);
    expect(can('outlet_manager', 'create', 'item')).toBe(false);
  });
});
