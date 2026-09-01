import { describe, it, expect } from 'vitest';
import { aggregatePayroll } from '@/lib/payroll-overview';
import { payableOf, type HrPayrollRow } from '@/lib/hr-payroll-bridge';

function row(over: Partial<HrPayrollRow> = {}): HrPayrollRow {
  return {
    payroll_id: 'PR-X', payroll_period: '2026-08', employee_id: 'EMP-1',
    employee_name: 'Andi', brand_id: 'BR-001', outlet_id: 'OL-001',
    basic_salary: '3000000', attendance_deduction: '0', overtime_pay: '0',
    bonus_total: '0', penalty_total: '0', allowance_total: '0',
    cash_advance_deduction: '0', bpjs_deduction: '0', tax_deduction: '0',
    gross_salary: '3000000', net_salary: '3000000',
    approval_status: 'APPROVED', payment_status: 'UNPAID',
    payment_date: '', created_at: '', finance_notified_at: '', finance_notified_by: '', email_sent_at: '', email_sent_to: '', email_sent_status: '',
    ...over
  };
}

describe('payableOf', () => {
  it('counts UNPAID+APPROVED as payable, excludes PAID and REJECTED case-insensitively', () => {
    expect(payableOf(row())).toBe(true);
    expect(payableOf(row({ payment_status: 'paid' }))).toBe(false);
    expect(payableOf(row({ approval_status: 'rejected' }))).toBe(false);
    expect(payableOf(row({ payment_status: 'PENDING', approval_status: 'PENDING' }))).toBe(true);
  });
});

describe('aggregatePayroll', () => {
  it('sums totals: payable excludes PAID rows, employee_count dedupes (period, employee)', () => {
    const rows = [
      row(),
      row({ employee_id: 'EMP-2', net_salary: '2000000', gross_salary: '2000000', payment_status: 'PAID' }),
      row({ employee_id: 'EMP-1', payroll_period: '2026-07' })
    ];
    const o = aggregatePayroll(rows, { 'BR-001': 'Funkydak' }, '');
    expect(o.totals.net_total).toBe(8_000_000);
    expect(o.totals.payable_total).toBe(6_000_000);
    expect(o.totals.paid_total).toBe(2_000_000);
    expect(o.totals.payable_count).toBe(2);
    expect(o.totals.employee_count).toBe(3);
  });

  it('groups per branch with brand name and sorts by payable desc', () => {
    const rows = [
      row({ brand_id: 'BR-001', net_salary: '1000000' }),
      row({ brand_id: 'BR-002', employee_id: 'EMP-2', net_salary: '3000000' }),
      row({ brand_id: 'BR-002', employee_id: 'EMP-3', net_salary: '500000' })
    ];
    const o = aggregatePayroll(rows, { 'BR-001': 'Funkydak', 'BR-002': 'Sekarpizza' }, '');
    expect(o.per_branch[0].brand_name).toBe('Sekarpizza');
    expect(o.per_branch[0].payable_total).toBe(3_500_000);
    expect(o.per_branch[0].employee_count).toBe(2);
    expect(o.per_branch[1].brand_name).toBe('Funkydak');
  });

  it('filters by period, brand and outlet scope', () => {
    const rows = [
      row({ payroll_period: '2026-08' }),
      row({ payroll_period: '2026-07', employee_id: 'EMP-2' }),
      row({ payroll_period: '2026-08', employee_id: 'EMP-3', brand_id: 'BR-002', outlet_id: 'OL-003' })
    ];
    const o = aggregatePayroll(rows, {}, '2026-08', { brandId: 'BR-001' });
    expect(o.totals.employee_count).toBe(1);
    const o2 = aggregatePayroll(rows, {}, '2026-08', { brandId: 'BR-002', outletId: 'OL-003' });
    expect(o2.totals.employee_count).toBe(1);
    const o3 = aggregatePayroll(rows, {}, '', {});
    expect(o3.totals.employee_count).toBe(3);
  });

  it('REJECTED rows contribute nothing to payable but stay in totals', () => {
    const rows = [
      row({ net_salary: '1000000' }),
      row({ employee_id: 'EMP-9', net_salary: '500000', approval_status: 'REJECTED' })
    ];
    const o = aggregatePayroll(rows, {}, '');
    expect(o.totals.net_total).toBe(1_500_000);
    expect(o.totals.payable_total).toBe(1_000_000);
    expect(o.per_branch[0].payable_total).toBe(1_000_000);
  });
});