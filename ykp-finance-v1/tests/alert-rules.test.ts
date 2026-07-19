import { describe, it, expect } from 'vitest';
import {
  evaluateFinanceAlerts, resolveThreshold, thresholdValue, shouldCreateAction,
  DEFAULT_THRESHOLDS, type FinanceRuleMetrics, type ThresholdRow
} from '../src/lib/alert-rules';

function metrics(over: Partial<FinanceRuleMetrics> = {}): FinanceRuleMetrics {
  return {
    date: '2026-07-10',
    outletId: 'OL-001',
    outletName: 'Funkydak Cipete',
    brandId: 'BR-001',
    brandName: 'Funkydak',
    cashDifference: 0,
    settlementDifference: 0,
    unpaidSupplier: 0,
    oldestUnpaidDays: 0,
    pettyCashOut: 0,
    totalExpense: 0,
    expenseAvg7d: 0,
    supplierCostThisWeek: 0,
    supplierCostPrevWeek: 0,
    estimatedSurplus: 1000000,
    grossSales: 5000000,
    refund: 0,
    voidAmount: 0,
    missingReceiptCount: 0,
    ...over
  };
}

describe('resolveThreshold (Revisi #10 scope precedence)', () => {
  const rows: ThresholdRow[] = [
    { key: 'petty_cash_daily_limit', value: '500000', scope: 'GLOBAL', active: 'true' },
    { key: 'petty_cash_daily_limit', value: '300000', scope: 'BRAND', brand_id: 'BR-001', active: 'true' },
    { key: 'petty_cash_daily_limit', value: '750000', scope: 'OUTLET', outlet_id: 'OL-001', active: 'true' },
    { key: 'petty_cash_daily_limit', value: '1', scope: 'OUTLET', outlet_id: 'OL-001', active: 'false' }
  ];

  it('OUTLET scope wins over BRAND and GLOBAL', () => {
    expect(thresholdValue(rows, 'petty_cash_daily_limit', { brandId: 'BR-001', outletId: 'OL-001' })).toBe(750000);
  });
  it('BRAND scope wins over GLOBAL when no outlet row', () => {
    expect(thresholdValue(rows, 'petty_cash_daily_limit', { brandId: 'BR-001', outletId: 'OL-002' })).toBe(300000);
  });
  it('GLOBAL when no scoped row matches', () => {
    expect(thresholdValue(rows, 'petty_cash_daily_limit', { brandId: 'BR-999', outletId: 'OL-999' })).toBe(500000);
  });
  it('inactive rows are ignored', () => {
    const r = resolveThreshold(rows, 'petty_cash_daily_limit', { brandId: 'BR-001', outletId: 'OL-001' });
    expect(r.value).toBe('750000'); // not the disabled '1'
  });
  it('falls back to built-in defaults when tab is empty', () => {
    expect(thresholdValue([], 'cash_difference_warning', {})).toBe(50000);
    expect(thresholdValue([], 'supplier_overdue_days_critical', {})).toBe(14);
  });
  it('unknown key throws', () => {
    expect(() => resolveThreshold([], 'nope', {})).toThrow('unknown threshold key');
  });
});

describe('evaluateFinanceAlerts (brief §11)', () => {
  it('cash_difference >= 50k fires HIGH; >= 200k CRITICAL', () => {
    const high = evaluateFinanceAlerts(metrics({ cashDifference: -75000 }), []);
    expect(high.find((a) => a.alertType === 'CASH_DIFFERENCE')?.severity).toBe('HIGH');
    const crit = evaluateFinanceAlerts(metrics({ cashDifference: 250000 }), []);
    expect(crit.find((a) => a.alertType === 'CASH_DIFFERENCE')?.severity).toBe('CRITICAL');
    expect(evaluateFinanceAlerts(metrics({ cashDifference: 10000 }), [])).toHaveLength(0);
  });

  it('supplier overdue: 7 hari MEDIUM, 14 hari HIGH', () => {
    const m = evaluateFinanceAlerts(metrics({ unpaidSupplier: 1500000, oldestUnpaidDays: 8 }), []);
    expect(m.find((a) => a.alertType === 'SUPPLIER_OVERDUE')?.severity).toBe('MEDIUM');
    const h = evaluateFinanceAlerts(metrics({ unpaidSupplier: 1500000, oldestUnpaidDays: 15 }), []);
    expect(h.find((a) => a.alertType === 'SUPPLIER_OVERDUE')?.severity).toBe('HIGH');
    // unpaid but not yet overdue → nothing
    expect(evaluateFinanceAlerts(metrics({ unpaidSupplier: 1500000, oldestUnpaidDays: 2 }), [])).toHaveLength(0);
  });

  it('petty cash over daily limit fires MEDIUM', () => {
    const a = evaluateFinanceAlerts(metrics({ pettyCashOut: 650000 }), []);
    expect(a.find((x) => x.alertType === 'PETTY_CASH_OVER_LIMIT')?.severity).toBe('MEDIUM');
    expect(evaluateFinanceAlerts(metrics({ pettyCashOut: 300000 }), [])).toHaveLength(0);
  });

  it('expense +20% vs 7-day average fires MEDIUM', () => {
    const a = evaluateFinanceAlerts(metrics({ totalExpense: 1300000, expenseAvg7d: 1000000 }), []);
    expect(a.find((x) => x.alertType === 'EXPENSE_SPIKE')?.severity).toBe('MEDIUM');
    expect(evaluateFinanceAlerts(metrics({ totalExpense: 1100000, expenseAvg7d: 1000000 }), [])).toHaveLength(0);
    // no baseline → no alert
    expect(evaluateFinanceAlerts(metrics({ totalExpense: 9999999, expenseAvg7d: 0 }), [])).toHaveLength(0);
  });

  it('supplier cost +15% week-over-week fires MEDIUM, +30% HIGH', () => {
    const m = evaluateFinanceAlerts(metrics({ supplierCostThisWeek: 1200000, supplierCostPrevWeek: 1000000 }), []);
    expect(m.find((x) => x.alertType === 'SUPPLIER_COST_SPIKE')?.severity).toBe('MEDIUM');
    const h = evaluateFinanceAlerts(metrics({ supplierCostThisWeek: 1350000, supplierCostPrevWeek: 1000000 }), []);
    expect(h.find((x) => x.alertType === 'SUPPLIER_COST_SPIKE')?.severity).toBe('HIGH');
  });

  it('negative estimated surplus fires HIGH (never called "net profit")', () => {
    const a = evaluateFinanceAlerts(metrics({ estimatedSurplus: -500000 }), []);
    const neg = a.find((x) => x.alertType === 'NEGATIVE_SURPLUS');
    expect(neg?.severity).toBe('HIGH');
    expect(neg?.title).toContain('Surplus kas');
    expect(neg?.title.toLowerCase()).not.toContain('profit');
  });

  it('refund/void tiers: 5% MEDIUM, 10% HIGH', () => {
    const m = evaluateFinanceAlerts(metrics({ refund: 300000, voidAmount: 0, grossSales: 5000000 }), []); // 6%
    expect(m.find((x) => x.alertType === 'HIGH_REFUND_VOID')?.severity).toBe('MEDIUM');
    const h = evaluateFinanceAlerts(metrics({ refund: 400000, voidAmount: 200000, grossSales: 5000000 }), []); // 12%
    expect(h.find((x) => x.alertType === 'HIGH_REFUND_VOID')?.severity).toBe('HIGH');
    expect(evaluateFinanceAlerts(metrics({ refund: 100000, grossSales: 5000000 }), [])).toHaveLength(0);
  });

  it('settlement mismatch beyond tolerance fires MEDIUM (Revisi #5)', () => {
    const a = evaluateFinanceAlerts(metrics({ settlementDifference: 75000 }), []);
    expect(a.find((x) => x.alertType === 'SETTLEMENT_MISMATCH')?.severity).toBe('MEDIUM');
    expect(evaluateFinanceAlerts(metrics({ settlementDifference: 5000 }), [])).toHaveLength(0);
  });

  it('missing receipt: 1-2 LOW, >=3 MEDIUM', () => {
    const low = evaluateFinanceAlerts(metrics({ missingReceiptCount: 1 }), []);
    expect(low.find((x) => x.alertType === 'MISSING_RECEIPT')?.severity).toBe('LOW');
    const med = evaluateFinanceAlerts(metrics({ missingReceiptCount: 3 }), []);
    expect(med.find((x) => x.alertType === 'MISSING_RECEIPT')?.severity).toBe('MEDIUM');
  });

  it('threshold overrides change firing behavior per outlet (Revisi #10)', () => {
    const override: ThresholdRow[] = [
      { key: 'cash_difference_warning', value: '100000', scope: 'OUTLET', outlet_id: 'OL-001', active: 'true' }
    ];
    // 75k diff: below outlet override of 100k → no alert
    expect(evaluateFinanceAlerts(metrics({ cashDifference: -75000 }), override)).toHaveLength(0);
    // other outlet without override still uses global 50k
    expect(
      evaluateFinanceAlerts(metrics({ outletId: 'OL-002', cashDifference: -75000 }), override)
        .find((a) => a.alertType === 'CASH_DIFFERENCE')?.severity
    ).toBe('HIGH');
  });
});

describe('shouldCreateAction', () => {
  it('HIGH/CRITICAL auto-create actions; lower severities do not', () => {
    expect(shouldCreateAction('HIGH')).toBe(true);
    expect(shouldCreateAction('CRITICAL')).toBe(true);
    expect(shouldCreateAction('MEDIUM')).toBe(false);
    expect(shouldCreateAction('LOW')).toBe(false);
  });
});

describe('DEFAULT_THRESHOLDS sanity', () => {
  it('contains all keys the engine consumes', () => {
    const keys = DEFAULT_THRESHOLDS.map((t) => t.key);
    for (const k of [
      'cash_difference_warning', 'cash_difference_critical',
      'supplier_overdue_days_warning', 'supplier_overdue_days_critical',
      'petty_cash_daily_limit', 'expense_spike_pct', 'supplier_cost_spike_pct',
      'refund_void_pct_warning', 'refund_void_pct_high',
      'settlement_mismatch_tolerance', 'missing_receipt_min_amount'
    ]) {
      expect(keys).toContain(k);
    }
  });
});
