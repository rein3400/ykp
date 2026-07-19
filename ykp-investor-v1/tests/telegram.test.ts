import { describe, it, expect } from 'vitest';
import {
  shouldPushAlert, shouldNotifyNewAlert, alertAlreadyDelivered,
  formatAlertMessage, composeInvestorDailyBrief
} from '@/lib/telegram';

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
    expect(shouldNotifyNewAlert(false, 'HIGH')).toBe(false);
    expect(shouldNotifyNewAlert(false, 'CRITICAL')).toBe(false);
    expect(shouldNotifyNewAlert(true, 'MEDIUM')).toBe(false);
    expect(shouldNotifyNewAlert(true, 'LOW')).toBe(false);
  });
});

describe('alertAlreadyDelivered (delivery-log dedupe)', () => {
  const deliveries: Record<string, string>[] = [
    { source_reference_id: 'ALR-1', message_type: 'ALERT', status: 'SENT' },
    { source_reference_id: 'ALR-2', message_type: 'ALERT', status: 'FAILED' },
    { source_reference_id: 'ALR-3', message_type: 'DAILY_BRIEF', status: 'SENT' },
    { source_reference_id: 'ALR-4', message_type: 'ALERT', status: 'QUEUED' }
  ];
  it('true when an ALERT delivery was logged (SENT or FAILED)', () => {
    expect(alertAlreadyDelivered(deliveries, 'ALR-1')).toBe(true);
    expect(alertAlreadyDelivered(deliveries, 'ALR-2')).toBe(true);
  });
  it('false for other message types, non-terminal statuses or unknown ids', () => {
    expect(alertAlreadyDelivered(deliveries, 'ALR-3')).toBe(false);
    expect(alertAlreadyDelivered(deliveries, 'ALR-4')).toBe(false);
    expect(alertAlreadyDelivered(deliveries, 'ALR-9')).toBe(false);
    expect(alertAlreadyDelivered([], 'ALR-1')).toBe(false);
  });
});

describe('formatAlertMessage', () => {
  it('includes severity, message and date', () => {
    const text = formatAlertMessage('investor', {
      alertId: 'ALR-1', severity: 'CRITICAL', title: 'Dividend overdue',
      message: 'Dividend overdue', date: '2026-07-10'
    });
    expect(text).toContain('[CRITICAL] Dividend overdue');
    expect(text).toContain('2026-07-10');
    expect(text).toContain('investor');
  });
});

describe('composeInvestorDailyBrief', () => {
  it('contains Rp-formatted KPIs and HIGH/CRITICAL alerts only', () => {
    const text = composeInvestorDailyBrief('2026-07-10', {
      summary_id: 'SUM-1', date: '2026-07-10',
      total_revenue: '25000000', total_profit: '8000000', total_capital: '5000000000',
      active_investors: '4', dividend_declared: '500000000', growth_pct: '12'
    }, [
      { message: 'Profit turun 30%', severity: 'HIGH', status: 'OPEN' },
      { message: 'Info saja', severity: 'LOW', status: 'OPEN' },
      { message: 'Sudah resolved', severity: 'CRITICAL', status: 'RESOLVED' }
    ]);
    expect(text).toContain('YKP INVESTOR DAILY BRIEF');
    expect(text).toContain('Total Revenue: Rp 25.000.000');
    expect(text).toContain('Total Capital: Rp 5.000.000.000');
    expect(text).toContain('Active Investors: 4');
    expect(text).toContain('Growth: 12%');
    expect(text).toContain('Profit turun 30% (HIGH)');
    expect(text).not.toContain('Info saja');
    expect(text).not.toContain('Sudah resolved');
  });
  it('works with null summary and no alerts', () => {
    const text = composeInvestorDailyBrief('2026-07-10', null, []);
    expect(text).toContain('YKP INVESTOR DAILY BRIEF');
    expect(text).toContain('Active Investors: 0');
    expect(text).not.toContain('CRITICAL/HIGH ALERTS');
  });
});
