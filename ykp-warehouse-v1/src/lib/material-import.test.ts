import { describe, expect, it } from 'vitest';
import { materialItem } from './material-import';
describe('material import identity and units', () => {
  it('keeps package variants and brand identities distinct', () => {
    const a = materialItem('BR1', 'Maizena', '500', 'gr');
    expect(a.base_unit).toBe('g');
    expect(a.pack_size).toBe('500');
    expect(a.purchase_unit).toBe('pack');
    expect(a.conversion_factor).toBe('500');
    expect(materialItem('BR1', ' Maizena ', '500', 'gr').item_id).toBe(a.item_id);
    expect(materialItem('BR1', 'Maizena', '1000', 'gr').item_id).not.toBe(a.item_id);
    expect(materialItem('BR2', 'Maizena', '500', 'gr').item_id).not.toBe(a.item_id);
  });
  it('preserves count packaging without guessing pack contents or prices', () => {
    const row = materialItem('BR1', 'Cheese slices', '1', 'pax');
    expect(row.base_unit).toBe('pax');
    expect(row.conversion_factor).toBe('1');
    expect(row.latest_purchase_price).toBeUndefined();
    expect(row.preferred_supplier_id).toBeUndefined();
  });
  it('rejects incomplete, invalid or unknown units', () => {
    for (const [weight,unit] of [['',''],['0','gr'],['NaN','ml'],['10','unknown']]) expect(() => materialItem('BR1','Bumbu',weight,unit)).toThrow();
  });
});
