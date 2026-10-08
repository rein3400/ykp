import { describe, expect, it } from 'vitest';
import { planMasterPurge } from './master-purge';

describe('planMasterPurge', () => {
  const items = [{ item_id: 'ITM-1' }, { item_id: 'ITM-2' }];
  const suppliers = [{ supplier_id: 'SUP-1' }, { supplier_id: 'SUP-2' }];
  it('deletes masters with no references and blocks the referenced ones', () => {
    const plan = planMasterPurge(items, suppliers, { 'ITM-1': ['receiving_item'], 'SUP-2': ['item:preferred_supplier'] });
    expect(plan.deletableItems.map((i) => i.item_id)).toEqual(['ITM-2']);
    expect(plan.blockedItems).toEqual([{ id: 'ITM-1', domains: ['receiving_item'] }]);
    expect(plan.deletableSuppliers.map((s) => s.supplier_id)).toEqual(['SUP-1']);
    expect(plan.blockedSuppliers).toEqual([{ id: 'SUP-2', domains: ['item:preferred_supplier'] }]);
  });
  it('treats every referencing domain as a blocker and is order-stable', () => {
    const plan = planMasterPurge(items, suppliers, {
      'ITM-1': ['stock_movement', 'batch_stock'],
      'ITM-2': ['unit_conversion'],
      'SUP-1': ['receiving'],
      'SUP-2': ['item:backup_supplier', 'purchase_request']
    });
    expect(plan.deletableItems).toEqual([]);
    expect(plan.deletableSuppliers).toEqual([]);
    expect(plan.blockedItems[0].domains).toEqual(['batch_stock', 'stock_movement']);
  });
  it('is a no-op when there are no references', () => {
    const plan = planMasterPurge(items, suppliers, {});
    expect(plan.deletableItems).toHaveLength(2);
    expect(plan.deletableSuppliers).toHaveLength(2);
    expect(plan.blockedItems).toEqual([]);
  });
});
