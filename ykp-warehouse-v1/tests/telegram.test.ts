import { describe, it, expect } from 'vitest';
import {
  shouldPushAlert, shouldNotifyNewAlert, formatAlertMessage,
  composeDailyBrief, formatRp, composeFraudWatchBlock
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
  it('includes severity, title, message and meta line', () => {
    const text = formatAlertMessage('warehouse', {
      alertId: 'ALR-1', severity: 'HIGH', title: 'Low stock: Ayam',
      message: 'Ayam tersisa 2 kg', outletName: 'FKD Cipete', date: '2026-07-10'
    });
    expect(text).toContain('[HIGH] Low stock: Ayam');
    expect(text).toContain('FKD Cipete — 2026-07-10');
    expect(text).toContain('Ayam tersisa 2 kg');
    expect(text).toContain('warehouse');
  });
  it('omits duplicate message and empty meta', () => {
    const text = formatAlertMessage('warehouse', {
      alertId: 'ALR-2', severity: 'CRITICAL', title: 'Stockout', message: 'Stockout'
    });
    const occurrences = text.split('Stockout').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('formatRp', () => {
  it('formats IDR with id-ID grouping', () => {
    expect(formatRp('1234567')).toBe('Rp 1.234.567');
    expect(formatRp('0')).toBe('Rp 0');
    expect(formatRp('')).toBe('Rp 0');
  });
});

describe('composeDailyBrief', () => {
  const summary: Record<string, string> = {
    date: '2026-07-10',
    total_inventory_value: '15000000',
    critical_low_stock_count: '3',
    stockout_risk_count: '1',
    estimated_purchase_value: '2500000',
    waste_value: '150000',
    unexplained_variance_value: '75000',
    near_expiry_item_count: '2',
    open_action_count: '4',
    major_warehouse_issue: '3 item kritikal di bawah minimum stock',
    recommended_action: 'Review purchase recommendation'
  };
  it('contains Rp-formatted KPIs, issue, action and alerts', () => {
    const text = composeDailyBrief('YKP Warehouse', summary, [
      { title: 'Low stock: Ayam', severity: 'HIGH', status: 'OPEN' },
      { title: 'Old thing', severity: 'HIGH', status: 'RESOLVED' },
      { title: 'Info', severity: 'MEDIUM', status: 'OPEN' }
    ]);
    expect(text).toContain('YKP WAREHOUSE DAILY BRIEF');
    expect(text).toContain('Rp 15.000.000');
    expect(text).toContain('Critical Low Stock: 3 item');
    expect(text).toContain('3 item kritikal di bawah minimum stock');
    expect(text).toContain('Low stock: Ayam (HIGH)');
    // RESOLVED and MEDIUM alerts are excluded
    expect(text).not.toContain('Old thing');
    expect(text).not.toContain('Info');
  });
  it('works with empty optional fields', () => {
    const text = composeDailyBrief('YKP Warehouse', { date: '2026-07-10' }, []);
    expect(text).toContain('YKP WAREHOUSE DAILY BRIEF');
    expect(text).not.toContain('Major Issue');
    expect(text).not.toContain('CRITICAL/HIGH ALERTS');
  });
});

describe('composeFraudWatchBlock', () => {
  it('lists the day manipulation-prone events', () => {
    const text = composeFraudWatchBlock({
      wasteToday: { count: 2, value: 150000 },
      adjustmentsToday: { pending: 1, approved: 3 },
      receivingDiscrepanciesToday: 2,
      staleApprovals: 4
    }, '2026-07-18');
    expect(text).toContain('FRAUD WATCH');
    expect(text).toContain('Waste hari ini: 2 kasus (Rp 150.000)');
    expect(text).toContain('1 pending / 3 approved');
    expect(text).toContain('Receiving discrepancy: 2');
    expect(text).toContain('Approval menggantung');
    expect(text).toContain('hash-chained');
  });
  it('omits stale-approval warning when zero', () => {
    const text = composeFraudWatchBlock({
      wasteToday: { count: 0, value: 0 },
      adjustmentsToday: { pending: 0, approved: 0 },
      receivingDiscrepanciesToday: 0,
      staleApprovals: 0
    }, '2026-07-18');
    expect(text).not.toContain('menggantung');
  });
});
