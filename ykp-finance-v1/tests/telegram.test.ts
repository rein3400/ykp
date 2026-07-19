import { describe, it, expect } from 'vitest';
import {
  shouldPushAlert, shouldNotifyNewAlert, formatAlertMessage, buildFinanceDailyBrief
} from '../src/lib/telegram';

describe('shouldPushAlert', () => {
  it('pushes only HIGH/CRITICAL', () => {
    expect(shouldPushAlert('CRITICAL')).toBe(true);
    expect(shouldPushAlert('HIGH')).toBe(true);
    expect(shouldPushAlert('MEDIUM')).toBe(false);
    expect(shouldPushAlert('LOW')).toBe(false);
    expect(shouldPushAlert('')).toBe(false);
  });
});

describe('shouldNotifyNewAlert (dedupe decision)', () => {
  it('pushes only newly created HIGH/CRITICAL alerts', () => {
    expect(shouldNotifyNewAlert(true, 'HIGH')).toBe(true);
    expect(shouldNotifyNewAlert(true, 'CRITICAL')).toBe(true);
    // re-upserted existing alert → no push
    expect(shouldNotifyNewAlert(false, 'HIGH')).toBe(false);
    expect(shouldNotifyNewAlert(false, 'CRITICAL')).toBe(false);
    // newly created but low severity → no push
    expect(shouldNotifyNewAlert(true, 'MEDIUM')).toBe(false);
    expect(shouldNotifyNewAlert(true, 'LOW')).toBe(false);
  });
});

describe('formatAlertMessage', () => {
  it('includes severity, title, outlet and date', () => {
    const text = formatAlertMessage('finance', {
      alertId: 'ALR-1', severity: 'CRITICAL', title: 'Kas selisih Rp 500.000',
      message: 'Selisih kas melebihi threshold', outletName: 'FKD Cipete', date: '2026-07-10'
    });
    expect(text).toContain('[CRITICAL] Kas selisih Rp 500.000');
    expect(text).toContain('FKD Cipete — 2026-07-10');
    expect(text).toContain('Selisih kas melebihi threshold');
    expect(text).toContain('finance');
  });
});

describe('buildFinanceDailyBrief', () => {
  it('sums Rp-formatted KPIs and lists HIGH/CRITICAL alerts only', () => {
    const text = buildFinanceDailyBrief('2026-07-10', [
      { date: '2026-07-10', net_sales: '10000000', total_expense: '3000000', supplier_cost: '2000000', estimated_surplus: '5000000', unpaid_supplier: '1500000' },
      { date: '2026-07-10', net_sales: '5000000', total_expense: '1000000', supplier_cost: '500000', estimated_surplus: '3500000', unpaid_supplier: '0' }
    ], [
      { title: 'Kas selisih besar', severity: 'HIGH', status: 'OPEN' },
      { title: 'Refund naik', severity: 'MEDIUM', status: 'OPEN' }
    ]);
    expect(text).toContain('YKP FINANCE DAILY BRIEF');
    expect(text).toContain('Total Net Sales: Rp 15.000.000');
    expect(text).toContain('Total Expense: Rp 4.000.000');
    expect(text).toContain('Estimasi Surplus Kas: Rp 8.500.000');
    expect(text).toContain('Kas selisih besar (HIGH)');
    expect(text).not.toContain('Refund naik');
  });
  it('works with empty inputs', () => {
    const text = buildFinanceDailyBrief('2026-07-10', [], []);
    expect(text).toContain('YKP FINANCE DAILY BRIEF');
    expect(text).toContain('Rp 0');
    expect(text).not.toContain('ALERT HIGH/CRITICAL');
  });
});
