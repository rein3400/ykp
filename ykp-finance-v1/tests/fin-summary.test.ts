import { describe, it, expect } from 'vitest';
import {
  computeDailySummary, computeRingkasan, sumSupplierCost, sumPettyCashOut,
  sumExpenses, sumUnpaidSupplier, isInactiveStatus, computeGroupCashPosition,
  momNetSalesGrowth, unpaidAging, dailySeries, type FinanceRows
} from '../src/lib/fin-summary';

const D = '2026-07-10';

function posRow(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    pos_id: 'POS-1', date: D, brand_id: 'BR-001', outlet_id: 'OL-001',
    gross_sales: '5000000', net_sales: '4800000', discount: '100000',
    refund: '50000', void: '50000', transaction_count: '80',
    settle_cash: '2000000', settle_qris: '1500000', settle_card: '800000',
    settle_transfer: '300000', settle_marketplace: '200000',
    total_settlement: '4800000', settlement_difference: '0',
    ...over
  };
}

function expenseRow(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    expense_id: 'EXP-1', date: D, brand_id: 'BR-001', outlet_id: 'OL-001',
    expense_category: 'Listrik', amount: '500000', payment_method: 'PM-CASH',
    approval_status: 'APPROVED', status: 'ACTIVE',
    linked_supplier_invoice_id: '', linked_petty_cash_id: '',
    ...over
  };
}

function supplierRow(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    costing_id: 'SUPC-1', date_order: D, brand_id: 'BR-001', outlet_id: 'OL-001',
    supplier_id: 'SUP-001', supplier_name: 'CV Ayam', total_amount: '1000000',
    paid_amount: '0', unpaid_amount: '1000000', payment_status: 'UNPAID',
    due_date: '2026-07-17', linked_expense_id: '', linked_petty_cash_id: '',
    ...over
  };
}

function pettyRow(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    petty_id: 'PC-1', date: D, brand_id: 'BR-001', outlet_id: 'OL-001',
    account_id: 'PCA-001', debit_topup: '0', credit_out: '200000',
    running_balance: '800000', approval_status: 'APPROVED',
    linked_expense_id: '', linked_supplier_invoice_id: '',
    ...over
  };
}

function closingRow(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    closing_id: 'CLS-1', date: D, brand_id: 'BR-001', outlet_id: 'OL-001',
    cash_difference: '-75000', created_at: '2026-07-10 22:00:00',
    physical_cash: '1000000',
    ...over
  };
}

function rows(partial: Partial<FinanceRows> = {}): FinanceRows {
  return { pos: [], expenses: [], suppliers: [], petty: [], closing: [], ...partial };
}

describe('isInactiveStatus (CANCELLED/REJECTED exclusion, ported fix)', () => {
  it('flags cancelled/rejected case-insensitively', () => {
    expect(isInactiveStatus('CANCELLED')).toBe(true);
    expect(isInactiveStatus('rejected')).toBe(true);
    expect(isInactiveStatus('APPROVED')).toBe(false);
    expect(isInactiveStatus('')).toBe(false);
  });
});

describe('computeDailySummary', () => {
  it('computes the fin_daily_summary contract fields', () => {
    const r = computeDailySummary(rows({
      pos: [posRow()],
      expenses: [expenseRow()],
      suppliers: [supplierRow()],
      petty: [pettyRow()],
      closing: [closingRow()]
    }), D, 'OL-001');

    expect(r.grossSales).toBe(5000000);
    expect(r.netSales).toBe(4800000);
    expect(r.discount).toBe(100000);
    expect(r.refund).toBe(50000);
    expect(r.voidAmount).toBe(50000);
    expect(r.transactionCount).toBe(80);
    expect(r.aov).toBe(60000);
    expect(r.totalExpense).toBe(500000);
    expect(r.supplierCost).toBe(1000000);
    expect(r.pettyCashOut).toBe(200000);
    expect(r.unpaidSupplier).toBe(1000000);
    expect(r.cashDifference).toBe(-75000);
    // 4.800.000 - 500.000 - 1.000.000 - 200.000
    expect(r.estimatedSurplus).toBe(3100000);
    expect(r.topSupplier).toBe('CV Ayam');
    expect(r.topExpenseCategory).toBe('Listrik');
    expect(r.majorFinanceIssue).toBe('cash_difference');
    expect(r.recommendedAction).toContain('Audit kas');
  });

  it('Revisi #4: supplier cost linked to an expense is excluded (no double count)', () => {
    const linked = supplierRow({ costing_id: 'SUPC-2', linked_expense_id: 'EXP-9', total_amount: '300000' });
    const plain = supplierRow({ costing_id: 'SUPC-3', total_amount: '700000' });
    expect(sumSupplierCost([linked, plain], D, 'OL-001')).toBe(700000);
  });

  it('Revisi #4: petty cash linked to expense/supplier is excluded (no double count)', () => {
    const toExpense = pettyRow({ petty_id: 'PC-2', linked_expense_id: 'EXP-1', credit_out: '100000' });
    const toSupplier = pettyRow({ petty_id: 'PC-3', linked_supplier_invoice_id: 'SUPC-1', credit_out: '150000' });
    const plain = pettyRow({ petty_id: 'PC-4', credit_out: '200000' });
    expect(sumPettyCashOut([toExpense, toSupplier, plain], D, 'OL-001')).toBe(200000);
  });

  it('excludes CANCELLED supplier rows and REJECTED expense rows', () => {
    const cancelled = supplierRow({ payment_status: 'CANCELLED' });
    expect(sumSupplierCost([cancelled], D, 'OL-001')).toBe(0);
    const rejected = expenseRow({ approval_status: 'REJECTED' });
    const cancelledExp = expenseRow({ status: 'CANCELLED', approval_status: 'APPROVED' });
    expect(sumExpenses([rejected, cancelledExp], D, 'OL-001')).toBe(0);
  });

  it('unpaid supplier accumulates outstanding up to the date, excludes PAID and future rows', () => {
    const old = supplierRow({ costing_id: 'S1', date_order: '2026-07-01', unpaid_amount: '400000' });
    const paid = supplierRow({ costing_id: 'S2', payment_status: 'PAID', paid_amount: '1000000', unpaid_amount: '0' });
    const future = supplierRow({ costing_id: 'S3', date_order: '2026-07-20' }); // after `date` → excluded
    expect(sumUnpaidSupplier([old, paid, future], D, 'OL-001')).toBe(400000);
    // without a date cap the future invoice is included
    expect(sumUnpaidSupplier([old, paid, future])).toBe(1400000);
  });

  it('uses the latest closing for cash difference', () => {
    const early = closingRow({ cash_difference: '-10000', created_at: '2026-07-10 21:00:00' });
    const late = closingRow({ cash_difference: '-75000', created_at: '2026-07-10 22:30:00' });
    const r = computeDailySummary(rows({ closing: [early, late] }), D, 'OL-001');
    expect(r.cashDifference).toBe(-75000);
  });

  it('major issue priority: settlement mismatch when no cash difference', () => {
    const r = computeDailySummary(rows({
      pos: [posRow({ settlement_difference: '50000' })]
    }), D, 'OL-001');
    expect(r.majorFinanceIssue).toBe('settlement_mismatch');
  });

  it('never emits a "net profit" field — estimated_surplus only (Revisi #3)', () => {
    const r = computeDailySummary(rows({ pos: [posRow()] }), D, 'OL-001');
    expect(Object.keys(r)).toContain('estimatedSurplus');
    expect(Object.keys(r).join(' ')).not.toMatch(/netProfit/i);
  });
});

describe('computeRingkasan', () => {
  it('aggregates a period with the same anti-double-count rules', () => {
    const f = { from: '2026-07-01', to: '2026-07-31' };
    const r = computeRingkasan(rows({
      pos: [posRow()],
      expenses: [expenseRow()],
      suppliers: [
        supplierRow(),
        // linked to an expense → excluded from supplier_cost accrual AND already settled, so not outstanding
        supplierRow({ costing_id: 'S2', linked_expense_id: 'EXP-1', total_amount: '999000', payment_status: 'PAID', paid_amount: '999000', unpaid_amount: '0' })
      ],
      petty: [pettyRow()],
      closing: [closingRow()]
    }), f);
    expect(r.netSales).toBe(4800000);
    expect(r.supplierCost).toBe(1000000);
    expect(r.pettyCashOut).toBe(200000);
    expect(r.estimatedSurplus).toBe(3100000);
    expect(r.cashIn).toBe(4800000);
    expect(r.cashOut).toBe(999000 + 500000 + 200000); // supplier paid + expense + petty
    expect(r.unpaidSupplier).toBe(1000000);
    expect(r.cashDifference).toBe(-75000);
    expect(r.topSupplier).toBe('CV Ayam');
    expect(r.topExpenseCategory).toBe('Listrik');
  });

  it('respects brand/outlet scope and period bounds', () => {
    const otherOutlet = posRow({ outlet_id: 'OL-999' });
    const outOfPeriod = posRow({ date: '2026-06-15' });
    const r = computeRingkasan(rows({ pos: [posRow(), otherOutlet, outOfPeriod] }), {
      from: '2026-07-01', to: '2026-07-31', outletId: 'OL-001'
    });
    expect(r.netSales).toBe(4800000);
  });
});

describe('computeGroupCashPosition', () => {
  it('sums latest petty balances + latest physical cash per outlet', () => {
    const petty = [
      pettyRow({ account_id: 'PCA-001', running_balance: '100000', date: '2026-07-09' }),
      pettyRow({ account_id: 'PCA-001', running_balance: '800000', date: '2026-07-10' }),
      pettyRow({ account_id: 'PCA-002', outlet_id: 'OL-002', running_balance: '500000', date: '2026-07-10' })
    ];
    const closing = [closingRow({ physical_cash: '1200000' })];
    expect(computeGroupCashPosition(petty, closing)).toBe(800000 + 500000 + 1200000);
  });
});

describe('momNetSalesGrowth', () => {
  it('computes % growth and null when no baseline', () => {
    const pos = [
      posRow({ date: '2026-07-05', net_sales: '2000000' }),
      posRow({ date: '2026-06-20', net_sales: '1000000' })
    ];
    expect(momNetSalesGrowth(pos, '2026-07', '2026-06')).toBe(100);
    expect(momNetSalesGrowth(pos, '2026-08', '2026-07')).toBe(-100);
    expect(momNetSalesGrowth([], '2026-07', '2026-06')).toBeNull();
  });
});

describe('unpaidAging', () => {
  it('buckets outstanding by days past due', () => {
    const today = '2026-07-10';
    const rowsS = [
      supplierRow({ costing_id: 'a', due_date: '2026-07-12', unpaid_amount: '100' }), // current
      supplierRow({ costing_id: 'b', due_date: '2026-07-05', unpaid_amount: '200' }), // 5d
      supplierRow({ costing_id: 'c', due_date: '2026-07-01', unpaid_amount: '300' }), // 9d
      supplierRow({ costing_id: 'd', due_date: '2026-06-25', unpaid_amount: '400' }), // 15d
      supplierRow({ costing_id: 'e', due_date: '2026-05-30', unpaid_amount: '500' })  // 41d
    ];
    const b = unpaidAging(rowsS, today);
    expect(b).toEqual({ current: 100, d1_7: 200, d8_14: 300, d15_30: 400, over30: 500 });
  });
});

describe('dailySeries', () => {
  it('builds per-day trend points', () => {
    const days = ['2026-07-09', '2026-07-10'];
    const s = dailySeries(rows({
      pos: [posRow()],
      expenses: [expenseRow()],
      suppliers: [supplierRow()],
      petty: [pettyRow()]
    }), days);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ date: '2026-07-09', netSales: 0, expense: 0 });
    expect(s[1]).toMatchObject({ date: '2026-07-10', netSales: 4800000, expense: 500000, refundVoid: 100000, aov: 60000 });
  });
});
