import { describe, it, expect } from 'vitest';
import {
  normalizeSeverity, sortAlerts, mergeAlerts, countBySeverity,
  isOverdue, isOpenStatus, alertsFromSummary, alertFromWarehouseRow,
  alertFromModuleRow, actionFromModuleRow
} from './alerts';
import type { OwnerAlert } from './types';

function alert(sev: OwnerAlert['severity'], time: string, id: string = sev): OwnerAlert {
  return { id, module: 'finance', severity: sev, brand: 'B', outlet: 'O', title: 't', message: 'm', time, status: 'OPEN', deepLink: '#' };
}

describe('normalizeSeverity', () => {
  it('maps module vocabularies onto the 4 owner levels', () => {
    expect(normalizeSeverity('critical')).toBe('CRITICAL');
    expect(normalizeSeverity('WARNING')).toBe('HIGH');
    expect(normalizeSeverity('high')).toBe('HIGH');
    expect(normalizeSeverity('Medium')).toBe('MEDIUM');
    expect(normalizeSeverity('')).toBe('LOW');
    expect(normalizeSeverity(undefined)).toBe('LOW');
  });
});

describe('sortAlerts / mergeAlerts', () => {
  it('orders CRITICAL → HIGH → MEDIUM → LOW, newest first inside severity', () => {
    const sorted = sortAlerts([
      alert('LOW', '2026-03-04 08:00'),
      alert('CRITICAL', '2026-03-04 07:00', 'c1'),
      alert('HIGH', '2026-03-04 09:00', 'h-new'),
      alert('HIGH', '2026-03-04 10:00', 'h-old'),
      alert('MEDIUM', '2026-03-04 11:00')
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['c1', 'h-old', 'h-new', 'MEDIUM', 'LOW']);
  });

  it('mergeAlerts concatenates and sorts', () => {
    const merged = mergeAlerts([alert('LOW', 't1')], [alert('CRITICAL', 't0')]);
    expect(merged[0].severity).toBe('CRITICAL');
    expect(merged).toHaveLength(2);
  });
});

describe('countBySeverity', () => {
  it('counts only requested severities', () => {
    const list = [alert('CRITICAL', '1'), alert('HIGH', '2'), alert('LOW', '3')];
    expect(countBySeverity(list, 'CRITICAL', 'HIGH')).toBe(2);
    expect(countBySeverity(list, 'LOW')).toBe(1);
  });
});

describe('isOverdue / isOpenStatus', () => {
  const today = '2026-03-04';
  it('flags past-due open actions as overdue', () => {
    expect(isOverdue('OPEN', '2026-03-03', today)).toBe(true);
    expect(isOverdue('OPEN', '2026-03-04', today)).toBe(false);
    expect(isOverdue('OPEN', '2026-03-05', today)).toBe(false);
    expect(isOverdue('OVERDUE', '2026-03-10', today)).toBe(true);
    expect(isOverdue('DONE', '2026-03-01', today)).toBe(false);
  });

  it('treats terminal states as closed', () => {
    expect(isOpenStatus('OPEN')).toBe(true);
    expect(isOpenStatus('IN_PROGRESS')).toBe(true);
    expect(isOpenStatus('DONE')).toBe(false);
    expect(isOpenStatus('RESOLVED')).toBe(false);
  });
});

describe('alertsFromSummary', () => {
  it('synthesizes a CRITICAL alert from critical_low_stock_count', () => {
    const alerts = alertsFromSummary('warehouse', [{
      summary_id: 'WH-1', date: '2026-03-04', brand_name: 'Funkydak', outlet_name: 'Funkydak Cipete',
      critical_low_stock_count: '3', expired_item_count: '0', major_warehouse_issue: ''
    }], '#wh');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].message).toContain('3 item stok kritis');
  });

  it('synthesizes a HIGH alert from cash_difference >= 50k', () => {
    const alerts = alertsFromSummary('finance', [{
      summary_id: 'F-1', date: '2026-03-04', brand_name: 'Suburbuns', outlet_name: 'Suburbuns Depok',
      cash_difference: '-75000', major_finance_issue: ''
    }], '#fin');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('HIGH');
  });

  it('produces nothing for a clean summary row', () => {
    const alerts = alertsFromSummary('ops', [{
      summary_id: 'O-1', date: '2026-03-04', brand_name: 'B', outlet_name: 'O',
      high_severity_incident: '0', major_ops_issue: ''
    }], '#ops');
    expect(alerts).toHaveLength(0);
  });
});

describe('alertFromWarehouseRow', () => {
  it('normalizes an alert_log row', () => {
    const a = alertFromWarehouseRow({
      alert_id: 'ALR-1', alert_datetime: '2026-03-04 16:20:00', severity: 'critical',
      brand_id: 'BR-001', outlet_id: 'OL-001', title: 'Stok kritis', message: 'Ayam habis', status: 'OPEN'
    }, 'warehouse', '#');
    expect(a.severity).toBe('CRITICAL');
    expect(a.time).toBe('2026-03-04 16:20');
    expect(a.message).toBe('Ayam habis');
  });
});

describe('alertFromModuleRow — finance/ops fixtures', () => {
  it('normalizes a finance alert_log row (brand/outlet names, date + created_at)', () => {
    // Shape written by ykp-finance regenerate: no alert_datetime; brand/outlet
    // carry display names instead of brand_name/outlet_name.
    const a = alertFromModuleRow({
      alert_id: 'ALR-2026-03-04-CASH_DIFF-OL-005', date: '2026-03-04',
      brand_id: 'BR-003', brand: 'Suburbuns', outlet_id: 'OL-005', outlet: 'Suburbuns Depok',
      source_app: 'finance', alert_type: 'CASH_DIFF', severity: 'HIGH',
      title: 'Selisih kas', message: 'Selisih kas -Rp75.000 saat closing',
      status: 'OPEN', created_at: '2026-03-04 21:35:00'
    }, 'finance', '#fin');
    expect(a.module).toBe('finance');
    expect(a.severity).toBe('HIGH');
    expect(a.brand).toBe('Suburbuns');
    expect(a.outlet).toBe('Suburbuns Depok');
    expect(a.time).toBe('2026-03-04 21:35');
    expect(a.id).toBe('ALR-2026-03-04-CASH_DIFF-OL-005');
  });

  it('normalizes an ops alert_log row (alert_datetime, id-only brand/outlet)', () => {
    const a = alertFromModuleRow({
      alert_id: 'ALR-OPS-1', alert_datetime: '2026-03-04 19:05:00', alert_type: 'INCIDENT',
      severity: 'critical', brand_id: 'BR-004', outlet_id: 'OL-006',
      title: 'Insiden berat', message: 'Kompor mati', status: 'OPEN'
    }, 'ops', '#ops');
    expect(a.module).toBe('ops');
    expect(a.severity).toBe('CRITICAL');
    expect(a.brand).toBe('BR-004');
    expect(a.outlet).toBe('OL-006');
    expect(a.time).toBe('2026-03-04 19:05');
  });
});

describe('actionFromModuleRow — finance/ops fixtures', () => {
  const today = '2026-03-04';
  it('normalizes a finance action_tracker row and flags overdue', () => {
    const a = actionFromModuleRow({
      action_id: 'ACT-2026-03-03-CASH_DIFF-OL-005', title: 'Audit closing kas',
      brand: 'Suburbuns', outlet: 'Suburbuns Depok', assigned_role: 'finance_admin',
      due_date: '2026-03-03', status: 'OPEN'
    }, 'finance', '#fin', today);
    expect(a.module).toBe('finance');
    expect(a.brand).toBe('Suburbuns');
    expect(a.pic).toBe('finance_admin');
    expect(a.overdue).toBe(true);
  });

  it('normalizes an ops action_tracker row (id-only brand/outlet)', () => {
    const a = actionFromModuleRow({
      action_id: 'ACT-OPS-1', title: 'Panggil teknisi', brand_id: 'BR-004',
      outlet_id: 'OL-006', assigned_to: 'spv-bintaro', due_date: '2026-03-05', status: 'IN_PROGRESS'
    }, 'ops', '#ops', today);
    expect(a.status).toBe('IN_PROGRESS');
    expect(a.overdue).toBe(false);
    expect(a.brand).toBe('BR-004');
  });
});
