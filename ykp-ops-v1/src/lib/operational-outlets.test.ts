import { describe, expect, it } from 'vitest';
import { operationalOutletScope } from './operational-outlets';
describe('operational outlet choices', () => {
  const rows = [
    { outlet_id: 'A', brand_id: 'B1', status: 'active' },
    { outlet_id: 'B', brand_id: 'B1', status: 'inactive' },
    { outlet_id: 'C', brand_id: 'B2', status: ' 1 ' }
  ];
  it('excludes inactive rows without changing masters', () => {
    expect(operationalOutletScope(rows, {}).map((row) => row.outlet_id)).toEqual(['A', 'C']);
    expect(rows).toHaveLength(3);
  });
  it('respects brand and outlet restrictions', () => {
    expect(operationalOutletScope(rows, { brandId: 'B1' }).map((row) => row.outlet_id)).toEqual(['A']);
    expect(operationalOutletScope(rows, { outletId: 'C' }).map((row) => row.outlet_id)).toEqual(['C']);
  });
});
