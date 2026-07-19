import { describe, it, expect } from 'vitest';
import { computeSettlement, mokaTolerance, settlementFromRow } from '../src/lib/settlement';

describe('computeSettlement (Revisi #5)', () => {
  it('sums all five payment methods', () => {
    const r = computeSettlement({ cash: 1000, qris: 500, card: 300, transfer: 100, marketplace: 100 }, 2000);
    expect(r.totalSettlement).toBe(2000);
    expect(r.settlementDifference).toBe(0);
    expect(r.mismatch).toBe(false);
  });

  it('positive difference when settlement is short of net sales', () => {
    const r = computeSettlement({ cash: 925000, qris: 0, card: 0, transfer: 0, marketplace: 0 }, 1000000);
    expect(r.settlementDifference).toBe(75000);
    expect(r.mismatch).toBe(true);
  });

  it('negative difference when settlement exceeds net sales', () => {
    const r = computeSettlement({ cash: 1100000 }, 1000000);
    expect(r.settlementDifference).toBe(-100000);
  });

  it('respects tolerance', () => {
    const r = computeSettlement({ cash: 995000 }, 1000000, 10000);
    expect(r.settlementDifference).toBe(5000);
    expect(r.mismatch).toBe(false);
  });

  it('clamps negative method parts to 0', () => {
    const r = computeSettlement({ cash: -5, qris: 100 }, 100);
    expect(r.cash).toBe(0);
    expect(r.totalSettlement).toBe(100);
  });
});

describe('mokaTolerance (blueprint §7.6: ≤1% or Rp10.000, whichever larger)', () => {
  it('10k floor for small sales', () => {
    expect(mokaTolerance(500000)).toBe(10000);
  });
  it('1% for large sales', () => {
    expect(mokaTolerance(5000000)).toBe(50000);
  });
});

describe('settlementFromRow', () => {
  it('reads settle_* columns from a sheet row', () => {
    const r = settlementFromRow({
      net_sales: '2000',
      settle_cash: '1000', settle_qris: '500', settle_card: '300',
      settle_transfer: '100', settle_marketplace: '100'
    });
    expect(r.totalSettlement).toBe(2000);
    expect(r.settlementDifference).toBe(0);
  });
});
