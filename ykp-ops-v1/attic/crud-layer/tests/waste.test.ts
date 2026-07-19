import { describe, it, expect } from 'vitest';
import { aggregateWaste, repeatedWasteIngredients, shiftDate } from '@/lib/waste';

const row = (date: string, name: string, qty: string, value: string, outlet = 'OL-001') => ({
  date, ingredient_name: name, qty, estimated_total_value: value, outlet_id: outlet
});

describe('aggregateWaste', () => {
  const rows = [
    row('2026-07-13', 'Ayam Fillet', '2', '106000'),
    row('2026-07-13', 'Saus', '1', '25000'),
    row('2026-07-13', 'Minyak', '2', '35000', 'OL-002'),
    row('2026-07-12', 'Ayam Fillet', '1', '53000')
  ];
  it('sums count/qty/value for one date+outlet', () => {
    const agg = aggregateWaste(rows, '2026-07-13', 'OL-001');
    expect(agg).toEqual({ count: 2, totalQty: 3, totalValue: 131000 });
  });
  it('aggregates across outlets when outlet omitted', () => {
    expect(aggregateWaste(rows, '2026-07-13').count).toBe(3);
  });
  it('returns zeros for empty day', () => {
    expect(aggregateWaste(rows, '2026-07-01')).toEqual({ count: 0, totalQty: 0, totalValue: 0 });
  });
});

describe('shiftDate', () => {
  it('shifts days both ways across month boundary', () => {
    expect(shiftDate('2026-07-13', -6)).toBe('2026-07-07');
    expect(shiftDate('2026-07-01', -1)).toBe('2026-06-30');
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('repeatedWasteIngredients (3x in 7 days = REVIEW)', () => {
  const ref = '2026-07-13';
  const rows = [
    row('2026-07-13', 'Ayam Fillet', '2', '106000'),
    row('2026-07-12', 'Ayam Fillet', '1', '53000'),
    row('2026-07-11', 'Ayam Fillet', '1.5', '79500'),
    row('2026-07-05', 'Ayam Fillet', '1', '53000'), // 8 days before ref ΓåÆ outside window
    row('2026-07-13', 'Saus', '1', '25000'),
    row('2026-07-12', 'Saus', '1', '25000'),
    row('2026-07-11', 'Saus', '1', '25000', 'OL-002') // different outlet
  ];
  it('detects ingredients wasted >= 3 times in trailing 7 days', () => {
    expect(repeatedWasteIngredients(rows, ref, 'OL-001')).toEqual(['Ayam Fillet']);
  });
  it('respects the 7-day window boundary (inclusive)', () => {
    // window: 2026-07-07 .. 2026-07-13
    const inWindow = repeatedWasteIngredients(rows, ref, 'OL-001', 7, 4);
    expect(inWindow).toEqual([]); // 4th occurrence is outside window
  });
  it('scopes per outlet', () => {
    expect(repeatedWasteIngredients(rows, ref, 'OL-002')).toEqual([]);
  });
  it('honours custom minCount/days', () => {
    // minCount 2 ΓåÆ Saus (2 rows at OL-001 in window) also qualifies
    expect(repeatedWasteIngredients(rows, ref, 'OL-001', 7, 2)).toEqual(['Ayam Fillet', 'Saus']);
    // short 2-day window ΓåÆ only items repeated on 07-12..07-13
    expect(repeatedWasteIngredients(rows, ref, 'OL-001', 2, 2)).toEqual(['Ayam Fillet', 'Saus']);
    expect(repeatedWasteIngredients(rows, ref, 'OL-001', 1, 3)).toEqual([]);
  });
});
