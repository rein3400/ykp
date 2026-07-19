import { describe, it, expect } from 'vitest';
import {
  shouldPushAlert, shouldNotifyNewAlert, formatAlertMessage, composeHrDailyBrief
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
    // re-upserted existing alert → no push
    expect(shouldNotifyNewAlert(false, 'HIGH')).toBe(false);
    expect(shouldNotifyNewAlert(false, 'CRITICAL')).toBe(false);
    // newly created but low severity → no push
    expect(shouldNotifyNewAlert(true, 'MEDIUM')).toBe(false);
    expect(shouldNotifyNewAlert(true, 'LOW')).toBe(false);
  });
});

describe('formatAlertMessage', () => {
  it('includes severity, message, outlet and date', () => {
    const text = formatAlertMessage('hr-v1', {
      alertId: 'HAL-1', severity: 'HIGH', title: '2 staff absen tanpa keterangan di FKD Cipete',
      message: '2 staff absen tanpa keterangan di FKD Cipete', outletName: 'FKD Cipete', date: '2026-07-10'
    });
    expect(text).toContain('[HIGH] 2 staff absen tanpa keterangan di FKD Cipete');
    expect(text).toContain('FKD Cipete — 2026-07-10');
    expect(text).toContain('hr-v1');
  });
});

describe('composeHrDailyBrief', () => {
  const summaries: Record<string, string>[] = [
    {
      date: '2026-07-10', outlet_id: 'OL-001', outlet_name: 'FKD Cipete',
      total_staff: '10', scheduled_staff: '8', staff_present: '7', staff_late: '2',
      staff_absent: '1', staff_leave: '0', incomplete_attendance: '1',
      total_late_minutes: '25', overtime_hours: '3', shift_shortage: '1',
      payroll_issue_count: '2', major_hr_issue: 'late_spike', recommended_action: 'Brief SPV'
    },
    {
      date: '2026-07-10', outlet_id: 'OL-002', outlet_name: 'FKD Kemang',
      total_staff: '12', scheduled_staff: '10', staff_present: '10', staff_late: '0',
      staff_absent: '0', staff_leave: '1', incomplete_attendance: '0',
      total_late_minutes: '0', overtime_hours: '1', shift_shortage: '0',
      payroll_issue_count: '0', major_hr_issue: '', recommended_action: ''
    }
  ];
  it('aggregates KPIs across outlets and lists issues + alerts', () => {
    const text = composeHrDailyBrief('2026-07-10', summaries, [
      { message: '1 staff absen tanpa keterangan di FKD Cipete', severity: 'HIGH', status: 'OPEN' },
      { message: 'Telat > 2', severity: 'MEDIUM', status: 'OPEN' },
      { message: 'Closed case', severity: 'CRITICAL', status: 'RESOLVED' }
    ]);
    expect(text).toContain('YKP HR DAILY BRIEF');
    expect(text).toContain('Outlets: 2');
    expect(text).toContain('Present: 17 / 18 scheduled (total staff 22)');
    expect(text).toContain('Late: 2 (25 min)');
    expect(text).toContain('Payroll issues: 2');
    expect(text).toContain('FKD Cipete: late_spike');
    expect(text).toContain('1 staff absen tanpa keterangan di FKD Cipete (HIGH)');
    // MEDIUM and RESOLVED alerts are excluded
    expect(text).not.toContain('Telat > 2');
    expect(text).not.toContain('Closed case');
  });
  it('works with no summaries and no alerts', () => {
    const text = composeHrDailyBrief('2026-07-10', [], []);
    expect(text).toContain('YKP HR DAILY BRIEF');
    expect(text).toContain('Outlets: 0');
    expect(text).not.toContain('Major Issues');
    expect(text).not.toContain('CRITICAL/HIGH ALERTS');
  });
});
