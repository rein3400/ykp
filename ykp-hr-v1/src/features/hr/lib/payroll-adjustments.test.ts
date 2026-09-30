import { describe, expect, it } from 'vitest';
import { summarizePayrollAdjustments } from './payroll-adjustments';

describe('summarizePayrollAdjustments', () => {
  it('groups incentive separately and totals other deduction types', () => {
    const totals = summarizePayrollAdjustments([
      { adjustment_type: 'BONUS', amount: '100000' },
      { adjustment_type: 'INCENTIVE', amount: '250000' },
      { adjustment_type: 'PENALTY', amount: '15000' },
      { adjustment_type: 'CASH_ADVANCE', amount: '50000' },
      { adjustment_type: 'OTHER_DEDUCTION', amount: '20000' },
      { adjustment_type: 'OTHER', amount: '5000' }
    ]);
    expect(totals.bonus).toBe(100000);
    expect(totals.incentive).toBe(250000);
    expect(totals.penalty).toBe(15000);
    expect(totals.cashAdvance).toBe(50000);
    expect(totals.otherDeduction).toBe(25000);
  });

  it('ignores invalid or negative values', () => {
    expect(summarizePayrollAdjustments([
      { adjustment_type: 'INCENTIVE', amount: '-20' },
      { adjustment_type: 'OTHER_DEDUCTION', amount: 'NaN' }
    ]).incentive).toBe(0);
  });
});
