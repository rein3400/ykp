import { describe, it, expect } from 'vitest';
import {
  DENOMINATIONS, denomTotal, denomColumn, expectedCash, cashDifference,
  discrepancyStatus, isCashAlert
} from '@/lib/cash';

describe('denominations', () => {
  it('covers the 10 IDR denominations from the brief', () => {
    expect(DENOMINATIONS).toEqual([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]);
  });
  it('computes physical cash from piece counts', () => {
    expect(denomTotal({ 100000: 14, 20000: 1, 5000: 1 })).toBe(1425000);
  });
  it('treats missing denominations as 0', () => {
    expect(denomTotal({})).toBe(0);
    expect(denomTotal({ 500: 2 })).toBe(1000);
  });
  it('maps denomination to sheet column', () => {
    expect(denomColumn(50000)).toBe('denom_50000');
    expect(denomColumn(100)).toBe('denom_100');
  });
});

describe('brief formulas', () => {
  // Expected Cash = Opening + POS Cash Sales ΓêÆ Petty Cash Used ΓêÆ Cash Deposit
  it('expectedCash follows the brief formula exactly', () => {
    expect(expectedCash({ openingCash: 500000, posCashSales: 2000000, pettyCashUsed: 150000, cashDeposit: 1000000 }))
      .toBe(1350000);
  });
  // Cash Difference = Physical ΓêÆ Expected
  it('cashDifference is physical minus expected', () => {
    expect(cashDifference(1425000, 1350000)).toBe(75000);
    expect(cashDifference(1300000, 1350000)).toBe(-50000);
  });
  it('Rp75.000 difference fires the HIGH alert (> Rp50.000)', () => {
    const expected = expectedCash({ openingCash: 500000, posCashSales: 2000000, pettyCashUsed: 150000, cashDeposit: 1000000 });
    const diff = cashDifference(1425000, expected);
    expect(diff).toBe(75000);
    expect(isCashAlert(diff, 50000)).toBe(true);
    expect(discrepancyStatus(diff, 50000)).toBe('OVER_TOLERANCE');
  });
});

describe('discrepancyStatus', () => {
  it('MATCHED only when exactly 0', () => {
    expect(discrepancyStatus(0)).toBe('MATCHED');
  });
  it('WITHIN_TOLERANCE inside the limit', () => {
    expect(discrepancyStatus(50000)).toBe('WITHIN_TOLERANCE');
    expect(discrepancyStatus(-49999)).toBe('WITHIN_TOLERANCE');
  });
  it('OVER_TOLERANCE above the limit', () => {
    expect(discrepancyStatus(50001)).toBe('OVER_TOLERANCE');
    expect(discrepancyStatus(-75000)).toBe('OVER_TOLERANCE');
  });
  it('CRITICAL beyond 4x tolerance', () => {
    expect(discrepancyStatus(200001)).toBe('CRITICAL');
    expect(discrepancyStatus(200000)).toBe('OVER_TOLERANCE');
  });
});

describe('isCashAlert', () => {
  it('strictly greater than tolerance', () => {
    expect(isCashAlert(50000)).toBe(false);
    expect(isCashAlert(-50000)).toBe(false);
    expect(isCashAlert(50001)).toBe(true);
    expect(isCashAlert(-50001)).toBe(true);
  });
});
