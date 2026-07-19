import { describe, it, expect } from 'vitest';
import {
  evaluateInvestorAlerts, alertIdFor,
  DIVIDEND_PAYMENT_TERMS_DAYS, CAPITAL_OUTFLOW_THRESHOLD_IDR,
  type InvestorRuleInput
} from '@/lib/investor-alerts';

const baseInput: InvestorRuleInput = {
  date: '2026-07-12',
  capital: [],
  dividend: [],
  financeRowsForDate: 1
};

describe('DIVIDEND_OVERDUE rule (HIGH)', () => {
  it('fires for a declared dividend past declared_at + payment terms', () => {
    const declared = '2026-06-01'; // due 2026-07-01, 11 days before eval date
    const input: InvestorRuleInput = {
      ...baseInput,
      dividend: [{ dividend_id: 'DVD-001', investor_id: 'INV-001', amount: '45000000', status: 'declared', declared_at: `${declared} 10:00:00` }]
    };
    const alerts = evaluateInvestorAlerts(input);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe('DIVIDEND_OVERDUE');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].referenceId).toBe('DVD-001');
    expect(alerts[0].message).toContain('DVD-001');
  });

  it('does not fire within the payment terms window', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      dividend: [{ dividend_id: 'DVD-002', investor_id: 'INV-001', amount: '1000', status: 'declared', declared_at: '2026-07-10 10:00:00' }]
    };
    expect(evaluateInvestorAlerts(input)).toHaveLength(0);
  });

  it('does not fire for paid dividends or rows without declared_at', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      dividend: [
        { dividend_id: 'DVD-003', investor_id: 'INV-001', amount: '1000', status: 'paid', declared_at: '2026-01-01 10:00:00' },
        { dividend_id: 'DVD-004', investor_id: 'INV-001', amount: '1000', status: 'declared', declared_at: '' }
      ]
    };
    expect(evaluateInvestorAlerts(input)).toHaveLength(0);
  });

  it('uses an entity-scoped deterministic ID (stable across re-run dates)', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      dividend: [{ dividend_id: 'DVD-001', investor_id: 'INV-001', amount: '1', status: 'declared', declared_at: '2026-06-01 10:00:00' }]
    };
    const [a] = evaluateInvestorAlerts(input);
    expect(alertIdFor(a, '2026-07-12')).toBe('ALR-DIVIDEND_OVERDUE-DVD-001');
    expect(alertIdFor(a, '2026-08-01')).toBe('ALR-DIVIDEND_OVERDUE-DVD-001');
  });
});

describe('CAPITAL_OUTFLOW rule (MEDIUM)', () => {
  it('fires when same-day out total exceeds the threshold', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      capital: [
        { capital_id: 'CAP-1', date: '2026-07-12', type: 'out', amount: String(CAPITAL_OUTFLOW_THRESHOLD_IDR) },
        { capital_id: 'CAP-2', date: '2026-07-12', type: 'out', amount: '1' }
      ]
    };
    const alerts = evaluateInvestorAlerts(input);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe('CAPITAL_OUTFLOW');
    expect(alerts[0].severity).toBe('MEDIUM');
  });

  it('ignores in-rows, other dates, and totals at or below the threshold', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      capital: [
        { capital_id: 'CAP-1', date: '2026-07-12', type: 'out', amount: String(CAPITAL_OUTFLOW_THRESHOLD_IDR) },
        { capital_id: 'CAP-2', date: '2026-07-12', type: 'in', amount: '999999999' },
        { capital_id: 'CAP-3', date: '2026-07-11', type: 'out', amount: '999999999' }
      ]
    };
    expect(evaluateInvestorAlerts(input)).toHaveLength(0);
  });

  it('uses a date-scoped deterministic ID', () => {
    const input: InvestorRuleInput = {
      ...baseInput,
      capital: [{ capital_id: 'CAP-1', date: '2026-07-12', type: 'out', amount: String(CAPITAL_OUTFLOW_THRESHOLD_IDR + 1) }]
    };
    const [a] = evaluateInvestorAlerts(input);
    expect(alertIdFor(a, '2026-07-12')).toBe('ALR-20260712-CAPITAL_OUTFLOW');
  });
});

describe('data_missing rule (LOW)', () => {
  it('fires when the finance cross-read has no row for the date', () => {
    const alerts = evaluateInvestorAlerts({ ...baseInput, financeRowsForDate: 0 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe('data_missing');
    expect(alerts[0].severity).toBe('LOW');
    expect(alertIdFor(alerts[0], '2026-07-12')).toBe('ALR-20260712-data_missing');
  });

  it('does not fire when finance rows exist for the date', () => {
    expect(evaluateInvestorAlerts({ ...baseInput, financeRowsForDate: 3 })).toHaveLength(0);
  });
});

describe('constants', () => {
  it('documents the payment terms and outflow threshold', () => {
    expect(DIVIDEND_PAYMENT_TERMS_DAYS).toBe(30);
    expect(CAPITAL_OUTFLOW_THRESHOLD_IDR).toBe(100_000_000);
  });
});
