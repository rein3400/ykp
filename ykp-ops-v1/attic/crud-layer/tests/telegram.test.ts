import { describe, it, expect } from 'vitest';
import {
  shouldPushAlert, shouldNotifyNewAlert, formatAlertMessage,
  composeOpsDailyBrief, formatRp
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
    // re-upserted existing alert ΓåÆ no push
    expect(shouldNotifyNewAlert(false, 'HIGH')).toBe(false);
    expect(shouldNotifyNewAlert(false, 'CRITICAL')).toBe(false);
    // newly created but low severity ΓåÆ no push
    expect(shouldNotifyNewAlert(true, 'MEDIUM')).toBe(false);
    expect(shouldNotifyNewAlert(true, 'LOW')).toBe(false);
  });
});

describe('formatAlertMessage', () => {
  it('includes severity, title, outlet and date', () => {
    const text = formatAlertMessage('ops', {
      alertId: 'ALR-OL-001-1', severity: 'HIGH', title: 'Closing belum approved',
      message: 'Closing melewati deadline', outletName: 'FKD Cipete', date: '2026-07-10'
    });
    expect(text).toContain('[HIGH] Closing belum approved');
    expect(text).toContain('FKD Cipete ΓÇö 2026-07-10');
    expect(text).toContain('Closing melewati deadline');
    expect(text).toContain('ops');
  });
});

describe('formatRp', () => {
  it('formats IDR with id-ID grouping', () => {
    expect(formatRp('1234567')).toBe('Rp 1.234.567');
    expect(formatRp('0')).toBe('Rp 0');
    expect(formatRp('')).toBe('Rp 0');
  });
});

describe('composeOpsDailyBrief', () => {
  const summary: Record<string, string> = {
    date: '2026-07-10', outlet_id: 'OL-001', outlet_name: 'FKD Cipete',
    opening_status: 'READY', opening_completion_percentage: '100',
    incident_count: '2', high_severity_incident: '1',
    waste_value: '250000', cash_difference: '-50000',
    closing_status: 'APPROVED', open_action_count: '3',
    major_ops_issue: 'Incident HIGH: freezer bocor', recommended_action: 'Panggil teknisi'
  };
  it('contains Rp-formatted KPIs, issue, action and scoped alerts', () => {
    const text = composeOpsDailyBrief('FKD Cipete', summary, [
      { title: 'Freezer bocor', severity: 'HIGH', status: 'OPEN', outlet_id: 'OL-001' },
      { title: 'Outlet lain', severity: 'CRITICAL', status: 'OPEN', outlet_id: 'OL-002' },
      { title: 'Info saja', severity: 'MEDIUM', status: 'OPEN', outlet_id: 'OL-001' },
      { title: 'Sudah resolved', severity: 'HIGH', status: 'RESOLVED', outlet_id: 'OL-001' }
    ]);
    expect(text).toContain('YKP OPS DAILY BRIEF');
    expect(text).toContain('FKD Cipete ΓÇö 2026-07-10');
    expect(text).toContain('Waste Value: Rp 250.000');
    expect(text).toContain('Cash Difference: Rp -50.000');
    expect(text).toContain('Incident HIGH: freezer bocor');
    expect(text).toContain('Freezer bocor (HIGH)');
    // other outlet, MEDIUM and RESOLVED alerts are excluded
    expect(text).not.toContain('Outlet lain');
    expect(text).not.toContain('Info saja');
    expect(text).not.toContain('Sudah resolved');
  });
  it('works with empty optional fields', () => {
    const text = composeOpsDailyBrief('FKD Cipete', { date: '2026-07-10', outlet_id: 'OL-001' }, []);
    expect(text).toContain('YKP OPS DAILY BRIEF');
    expect(text).not.toContain('Major Issue');
    expect(text).not.toContain('CRITICAL/HIGH ALERTS');
  });
});
