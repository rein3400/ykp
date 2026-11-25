import { describe, expect, it } from 'vitest';
import { can, scopeFilter, type Action, type Resource } from './rbac';

const RESOURCES: Resource[] = [
  'item', 'location', 'supplier', 'unit_conversion', 'category', 'threshold',
  'receiving', 'stock_issue', 'transfer', 'waste', 'adjustment',
  'stock_count', 'stock_ledger', 'batch_stock',
  'purchase_recommendation', 'purchase_request',
  'alert', 'action', 'summary', 'telegram',
  'dashboard', 'audit', 'user', 'master',
];
const ACTIONS: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'generate'];

describe('outlet manager parity with warehouse admin', () => {
  it('has exactly the same permissions as warehouse_admin', () => {
    const differences: string[] = [];
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        const admin = can('warehouse_admin', action, resource);
        const manager = can('outlet_manager', action, resource);
        if (admin !== manager) differences.push(`${action}:${resource} admin=${admin} manager=${manager}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it('keeps the outlet scope even with the wider permissions', () => {
    expect(scopeFilter('outlet_manager', 'BR-2', 'OL-12')).toEqual({ brandId: 'BR-2', outletId: 'OL-12' });
    expect(scopeFilter('warehouse_admin', 'BR-2', 'OL-12')).toEqual({});
  });

  it('can edit the stock ledger', () => {
    expect(can('warehouse_admin', 'update', 'stock_ledger')).toBe(true);
    expect(can('outlet_manager', 'update', 'stock_ledger')).toBe(true);
    expect(can('staff', 'update', 'stock_ledger')).toBe(false);
  });
});

describe('employee alias', () => {
  it('gives HR-synced employee accounts the staff permissions', () => {
    expect(can('employee', 'view', 'receiving')).toBe(true);
    expect(can('employee', 'create', 'receiving')).toBe(false);
  });

  it('scopes employee accounts to their outlet', () => {
    expect(scopeFilter('employee', 'BR-1', 'OL-1')).toEqual({ brandId: 'BR-1', outletId: 'OL-1' });
  });
});
