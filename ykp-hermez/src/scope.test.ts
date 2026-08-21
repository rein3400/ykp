import { describe, it, expect } from 'vitest';
import { filterRows, filterPerOutlet, filterItems } from './scope.js';
import type { Scope } from './actor.js';

const rows = [
  { brand_id: 'BR-001', outlet_id: 'OL-001', outlet_name: 'A', revenue: '100' },
  { brand_id: 'BR-001', outlet_id: 'OL-002', outlet_name: 'B', revenue: '200' },
  { brand_id: 'BR-002', outlet_id: 'OL-003', outlet_name: 'C', revenue: '300' }
];

describe('filterRows', () => {
  it('returns all rows for empty scope', () => {
    expect(filterRows(rows, {})).toHaveLength(3);
  });

  it('filters by outlet', () => {
    const out = filterRows(rows, { outletId: 'OL-001' });
    expect(out).toHaveLength(1);
    expect(out[0].outlet_name).toBe('A');
  });

  it('filters by brand', () => {
    const out = filterRows(rows, { brandId: 'BR-001' });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.brand_id === 'BR-001')).toBe(true);
  });

  it('returns empty when nothing matches', () => {
    expect(filterRows(rows, { outletId: 'OL-999' })).toHaveLength(0);
  });
});

describe('filterPerOutlet / filterItems', () => {
  it('filterPerOutlet matches outlet_id', () => {
    expect(filterPerOutlet(rows, { outletId: 'OL-002' })).toHaveLength(1);
  });

  it('filterItems matches outlet_id', () => {
    expect(filterItems(rows, { outletId: 'OL-003' })).toHaveLength(1);
  });

  it('empty scope passes everything through', () => {
    expect(filterPerOutlet(rows, {})).toHaveLength(3);
    expect(filterItems(rows, {})).toHaveLength(3);
  });
});

describe('nested / grouped rows (cross-outlet leak guard)', () => {
  // A tool that returns grouped rows without flattening. The top-level row
  // is scoped to OL-001, but it bundles an out-of-scope OL-002 member.
  const grouped = [
    {
      brand_id: 'BR-001',
      outlet_id: 'OL-001',
      outlet_name: 'A',
      items: [
        { outlet_id: 'OL-001', name: 'kopi', qty: '2' },
        { outlet_id: 'OL-002', name: 'teh', qty: '5' }
      ]
    }
  ];

  it('drops a group whose nested member is out-of-scope', () => {
    expect(filterRows(grouped, { outletId: 'OL-001' })).toHaveLength(0);
    expect(filterPerOutlet(grouped, { outletId: 'OL-001' })).toHaveLength(0);
    expect(filterItems(grouped, { outletId: 'OL-001' })).toHaveLength(0);
  });

  it('keeps a group when all nested members are in-scope', () => {
    const inScope = [
      {
        brand_id: 'BR-001',
        outlet_id: 'OL-001',
        items: [{ outlet_id: 'OL-001', name: 'kopi', qty: '2' }]
      }
    ];
    expect(filterRows(inScope, { outletId: 'OL-001' })).toHaveLength(1);
  });

  it('keeps a group whose nested members carry no own outlet_id (inherit parent)', () => {
    const noId = [
      {
        brand_id: 'BR-001',
        outlet_id: 'OL-001',
        items: [{ name: 'kopi', qty: '2' }]
      }
    ];
    expect(filterRows(noId, { outletId: 'OL-001' })).toHaveLength(1);
  });

  it('empty scope passes grouped rows through unfiltered', () => {
    expect(filterRows(grouped, {})).toHaveLength(1);
  });
});
