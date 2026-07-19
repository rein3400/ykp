import { describe, it, expect } from 'vitest';
import {
  computeInvestorSummary, toSummaryRow, addDays, datePart, firstNum,
  type InvestorRows
} from '@/lib/investor-summary';
import { invSummaryId } from '@/lib/id-gen';

const baseRows: InvestorRows = {
  investors: [
    { investor_id: 'INV-001', status: 'active' },
    { investor_id: 'INV-002', status: 'active' },
    { investor_id: 'INV-003', status: 'inactive' }
  ],
  capital: [
    { capital_id: 'CAP-1', investor_id: 'INV-001', date: '2026-07-01', type: 'in', amount: '500000000' },
    { capital_id: 'CAP-2', investor_id: 'INV-002', date: '2026-07-05', type: 'in', amount: '250000000' },
    { capital_id: 'CAP-3', investor_id: 'INV-001', date: '2026-07-10', type: 'out', amount: '50000000' },
    { capital_id: 'CAP-4', investor_id: 'INV-002', date: '2026-07-20', type: 'in', amount: '999999999' }
  ],
  shareholding: [
    { share_id: 'SHR-1', investor_id: 'INV-001', share_value: '5000000000' },
    { share_id: 'SHR-2', investor_id: 'INV-002', share_value: '3000000000' }
  ],
  dividend: [
    { dividend_id: 'DVD-1', investor_id: 'INV-001', amount: '45000000', status: 'paid', declared_at: '2026-07-01 10:00:00' },
    { dividend_id: 'DVD-2', investor_id: 'INV-002', amount: '20000000', status: 'declared', declared_at: '2026-07-12 09:00:00' }
  ]
};

const finRows = [
  { date: '2026-07-12', net_sales: '100000000', estimated_surplus: '25000000' },
  { date: '2026-07-12', net_sales: '50000000', estimated_surplus: '5000000' },
  { date: '2026-07-11', net_sales: '120000000', estimated_surplus: '30000000' }
];

describe('computeInvestorSummary', () => {
  it('sums finance cross-read rows for the exact date (net_sales / estimated_surplus)', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    expect(c.totalRevenue).toBe(150000000);
    expect(c.totalProfit).toBe(30000000);
    expect(c.financeRowsForDate).toBe(2);
  });

  it('falls back to legacy finance field names (revenue / net_profit_estimate)', () => {
    const legacy = [{ date: '2026-07-12', revenue: '7000', net_profit_estimate: '900' }];
    const c = computeInvestorSummary(baseRows, legacy, '2026-07-12');
    expect(c.totalRevenue).toBe(7000);
    expect(c.totalProfit).toBe(900);
  });

  it('computes total_capital cumulatively (in − out) up to the summary date', () => {
    // up to 07-12: 500jt in + 250jt in − 50jt out; the 07-20 row is excluded
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    expect(c.totalCapital).toBe(700000000);
    // up to 07-21: includes the later 999jt in
    const later = computeInvestorSummary(baseRows, finRows, '2026-07-21');
    expect(later.totalCapital).toBe(1699999999);
  });

  it('counts only active investors', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    expect(c.activeInvestors).toBe(2);
  });

  it('computes dividend_declared cumulatively (declared + paid) up to the date', () => {
    const before = computeInvestorSummary(baseRows, finRows, '2026-07-11');
    expect(before.dividendDeclared).toBe(45000000); // only DVD-1 declared by then
    const after = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    expect(after.dividendDeclared).toBe(65000000);
  });

  it('growth_pct is day-over-day revenue growth vs previous calendar day', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    // (150jt − 120jt) / 120jt = +25.0%
    expect(c.growthPct).toBe(25);
  });

  it('growth_pct is null when the previous day has no finance baseline', () => {
    // 2026-07-10's previous day (07-09) has no finance rows in the fixture
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-10');
    expect(c.growthPct).toBeNull();
  });

  it('shareholding value is context only, never folded into total_capital', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    expect(c.totalShareValue).toBe(8000000000);
    expect(c.totalCapital).toBe(700000000); // unchanged by share_value
  });

  it('handles empty inputs without NaN', () => {
    const c = computeInvestorSummary({ investors: [], capital: [], shareholding: [], dividend: [] }, [], '2026-07-12');
    expect(c.totalRevenue).toBe(0);
    expect(c.totalCapital).toBe(0);
    expect(c.activeInvestors).toBe(0);
    expect(c.dividendDeclared).toBe(0);
    expect(c.financeRowsForDate).toBe(0);
  });
});

describe('toSummaryRow', () => {
  it('maps computed values to the exact summary tab columns', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-12');
    const row = toSummaryRow(invSummaryId('2026-07-12'), c, '2026-07-12 22:00:00');
    expect(row).toEqual({
      summary_id: 'SUM-20260712',
      date: '2026-07-12',
      total_revenue: '150000000',
      total_profit: '30000000',
      total_capital: '700000000',
      active_investors: '2',
      dividend_declared: '65000000',
      growth_pct: '25',
      created_at: '2026-07-12 22:00:00'
    });
  });

  it('writes empty growth_pct when there is no baseline', () => {
    const c = computeInvestorSummary(baseRows, finRows, '2026-07-10');
    const row = toSummaryRow(invSummaryId('2026-07-10'), c, 't');
    expect(row.growth_pct).toBe('');
  });
});

describe('date helpers', () => {
  it('addDays shifts across month boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('datePart extracts YYYY-MM-DD from WIB timestamps', () => {
    expect(datePart('2026-07-12 09:30:00')).toBe('2026-07-12');
    expect(datePart('2026-07-12')).toBe('2026-07-12');
    expect(datePart('')).toBe('');
    expect(datePart(undefined)).toBe('');
  });
  it('firstNum picks the first present non-empty field', () => {
    expect(firstNum({ a: '5', b: '7' }, ['a', 'b'])).toBe(5);
    expect(firstNum({ a: '', b: '7' }, ['a', 'b'])).toBe(7);
    expect(firstNum({ b: '7' }, ['a', 'b'])).toBe(7);
    expect(firstNum({}, ['a', 'b'])).toBe(0);
  });
});
