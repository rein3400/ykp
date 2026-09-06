import { describe, it, expect } from 'vitest';
import { buildPayslipHtml } from './payslip-html';

const ROW: Record<string, string> = {
  payroll_id: 'PAY-001',
  employee_id: 'EMP-007',
  employee_name: 'Budi Santoso',
  payroll_period: '2026-09',
  outlet_id: 'OUT-01',
  basic_salary: '5000000',
  overtime_pay: '250000',
  bonus_total: '1000000',
  allowance_total: '500000',
  gross_salary: '6750000',
  attendance_deduction: '100000',
  penalty_total: '0',
  cash_advance_deduction: '200000',
  bpjs_deduction: '150000',
  tax_deduction: '50000',
  other_deduction: '0',
  net_salary: '6250000',
  payment_status: 'PAID',
  payment_date: '2026-09-05',
};

describe('buildPayslipHtml (extracted from payslip/[id] route)', () => {
  it('renders identity, title and formatted amounts', () => {
    const out = buildPayslipHtml('PAY-001', ROW);
    expect(out).toContain('<title>Slip Gaji - Budi Santoso - 2026-09</title>');
    expect(out).toContain('Budi Santoso');
    expect(out).toContain('2026-09');
    expect(out).toContain('EMP-007');
    expect(out).toContain('OUT-01');
    expect(out).toContain('Rp 5.000.000');
    expect(out).toContain('Rp 250.000');
    expect(out).toContain('Rp 1.000.000');
    expect(out).toContain('Rp 6.750.000');
    expect(out).toContain('Rp 6.250.000');
    expect(out).toContain('Rp 150.000');
    expect(out).toContain('download="slip-PAY-001.html"');
    expect(out).toContain('CONFIDENTIAL');
  });

  it('renders PAID badge and WIB payment date', () => {
    const out = buildPayslipHtml('PAY-001', ROW);
    expect(out).toContain('status-badge status-paid');
    expect(out).toContain('>PAID<');
    expect(out).toContain('5 September 2026');
  });

  it('renders PENDING badge and dash date when payment_date is empty', () => {
    const out = buildPayslipHtml('PAY-002', { ...ROW, payment_status: 'PENDING', payment_date: '' });
    expect(out).toContain('status-pending');
    expect(out).toContain('>PENDING<');
    expect(out).toContain('>-<');
    expect(out).toContain('status-badge status-pending');
    expect(out).not.toContain('status-badge status-paid');
  });

  it('falls back to UNPAID badge for unknown status', () => {
    const out = buildPayslipHtml('PAY-003', { ...ROW, payment_status: '' });
    expect(out).toContain('status-unpaid');
    expect(out).toContain('>UNPAID<');
  });
});
