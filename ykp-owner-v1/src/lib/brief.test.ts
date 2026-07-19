import { describe, it, expect } from 'vitest';
import { computeAlertLevel, composeBrief } from './brief';
import { consolidateFinance, consolidateHr, consolidateWarehouse, buildHeadline } from './consolidate';
import { mockOverview } from './mock';
import { idr, num, formatDateShort, todayWib } from './format';

describe('computeAlertLevel', () => {
  it('any CRITICAL → red', () => {
    expect(computeAlertLevel(['LOW', 'CRITICAL'], false)).toBe('red');
  });
  it('any HIGH → yellow; data missing → at least yellow', () => {
    expect(computeAlertLevel(['HIGH'], false)).toBe('yellow');
    expect(computeAlertLevel([], true)).toBe('yellow');
  });
  it('no alerts and complete data → green', () => {
    expect(computeAlertLevel([], false)).toBe('green');
    expect(computeAlertLevel(['LOW', 'MEDIUM'], false)).toBe('green');
  });
});

describe('composeBrief', () => {
  const ov = mockOverview(new Date('2026-03-04T15:00:00Z'));
  const brief = composeBrief(ov);

  it('uses the Hermez header format `YKP Daily Brief - DD MMM YYYY`', () => {
    expect(brief.text.split('\n')[0]).toMatch(/^YKP Daily Brief - \d{1,2} \w{3} \d{4}$/);
    expect(brief.text.split('\n')[0]).toBe(`YKP Daily Brief - ${formatDateShort(ov.date)}`);
  });

  it('places the Level line right under the header', () => {
    expect(brief.text.split('\n')[1]).toMatch(/^Level: (GREEN|YELLOW|RED)$/);
  });

  it('contains every section including [Alerts] (N)', () => {
    for (const s of ['[Finance]', '[HR]', '[Warehouse]', '[Ops]', '[Action besok]']) {
      expect(brief.text).toContain(s);
    }
    expect(brief.text).toMatch(/\[Alerts\] \(\d+\)/);
  });

  it('never says "Net Profit" — always Estimasi surplus kas', () => {
    expect(brief.text).not.toMatch(/net profit/i);
    expect(brief.text).toContain('Estimasi surplus kas');
  });

  it('caps [Action besok] at 5 lines', () => {
    const section = brief.text.split('[Action besok]')[1];
    const items = section.split('\n').filter((l) => l.startsWith('- '));
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('mock overview yields red (it contains a CRITICAL alert)', () => {
    expect(brief.alertLevel).toBe('red');
  });

  it('keeps sections with `none` when a module has no rows', () => {
    const empty = mockOverview(new Date('2026-03-04T15:00:00Z'));
    empty.modules.ops.rows = [];
    empty.alerts = [];
    const b = composeBrief(empty);
    expect(b.text).toContain('[Ops]\n- none');
    expect(b.text).toContain('[Alerts] (0)\n- none');
  });
});

describe('consolidate*', () => {
  it('consolidateFinance sums per-outlet rows and derives AOV', () => {
    const kpi = consolidateFinance([
      { net_sales: '1000000', total_expense: '300000', estimated_surplus: '700000', unpaid_supplier: '100000', transaction_count: '20', cash_difference: '0', gross_sales: '1050000' },
      { net_sales: '500000', total_expense: '100000', estimated_surplus: '400000', unpaid_supplier: '0', transaction_count: '10', cash_difference: '-50000', gross_sales: '520000' }
    ]);
    expect(kpi.revenue).toBe(1500000);
    expect(kpi.expense).toBe(400000);
    expect(kpi.estimasiSurplus).toBe(1100000);
    expect(kpi.unpaidSupplier).toBe(100000);
    expect(kpi.aov).toBe(50000);
    expect(kpi.momPct).toBeNull();
  });

  it('consolidateHr totals presence columns', () => {
    const kpi = consolidateHr([
      { scheduled_staff: '5', staff_present: '4', staff_late: '2', staff_absent: '1', staff_leave: '0', shift_shortage: '1', payroll_issue_count: '0' },
      { scheduled_staff: '3', staff_present: '3', staff_late: '0', staff_absent: '0', staff_leave: '1', shift_shortage: '0', payroll_issue_count: '0' }
    ]);
    expect(kpi.scheduled).toBe(8);
    expect(kpi.present).toBe(7);
    expect(kpi.late).toBe(2);
    expect(kpi.shiftShortage).toBe(1);
  });

  it('consolidateWarehouse totals stock + value columns', () => {
    const kpi = consolidateWarehouse([
      { total_inventory_value: '1000000', critical_low_stock_count: '2', near_expiry_item_count: '1', expired_item_count: '0', unexplained_variance_value: '50000', purchase_recommendation_count: '1', estimated_purchase_value: '250000', stockout_risk_count: '1', waste_value: '10000' }
    ]);
    expect(kpi.inventoryValue).toBe(1000000);
    expect(kpi.criticalLowStock).toBe(2);
    expect(kpi.nearExpiry).toBe(1);
  });

  it('buildHeadline counts HIGH+CRITICAL alerts as open incidents', () => {
    const ov = mockOverview(new Date('2026-03-04T15:00:00Z'));
    const h = buildHeadline({
      finance: ov.modules.finance.rows, financePrev: [],
      hr: ov.modules.hr.rows, warehouse: ov.modules.warehouse.rows,
      alerts: ov.alerts
    });
    expect(h.openHighCriticalIncidents).toBe(3); // 1 CRITICAL + 2 HIGH in mock data
    expect(h.criticalStockCount).toBe(5); // 3 (OL-001) + 2 (OL-006)
    expect(h.estimasiSurplusKas).toBeGreaterThan(0);
  });
});

describe('format helpers', () => {
  it('idr formats Indonesian grouping', () => {
    expect(idr(12450000)).toBe('Rp12.450.000');
    expect(idr(-25000)).toBe('-Rp25.000');
    expect(idr(0)).toBe('Rp0');
  });
  it('num parses messy sheet cells', () => {
    expect(num('1.250.000')).toBe(1250000);
    expect(num('')).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });
  it('todayWib returns YYYY-MM-DD in Asia/Jakarta', () => {
    // 2026-03-04 16:30 UTC = 23:30 WIB same day
    expect(todayWib(new Date('2026-03-04T16:30:00Z'))).toBe('2026-03-04');
    // 2026-03-04 17:30 UTC = 00:30 WIB next day
    expect(todayWib(new Date('2026-03-04T17:30:00Z'))).toBe('2026-03-05');
  });
});
