import { describe, it, expect, beforeAll } from 'vitest';
import { buildPayslipPdfAttachment, buildPayslipPdf } from './payslip-pdf';

beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
});

// A payroll row shaped exactly like what validate-payment passes (Sheets row = strings).
const ROW: Record<string, string> = {
  payroll_id: 'PR-EMP-001-2026-09',
  payroll_period: '2026-09',
  employee_id: 'EMP-001',
  employee_name: 'Budi Santoso',
  brand_id: 'BR-001',
  basic_salary: '6500000',
  attendance_days: '26',
  absent_days: '0',
  attendance_deduction: '0',
  overtime_hours: '1',
  overtime_pay: '56250',
  bonus_total: '250000',
  incentive_total: '0',
  penalty_total: '0',
  allowance_total: '500000',
  cash_advance_deduction: '0',
  bpjs_deduction: '130000',
  tax_deduction: '162500',
  other_deduction: '0',
  gross_salary: '7306250',
  net_salary: '7013750',
  payment_reference: 'TRF-2026-10-001',
  payment_date: '2026-10-06'
};

describe('payslip PDF attachment', () => {
  it('produces a valid PDF buffer with the right filename', async () => {
    const { filename, content } = await buildPayslipPdfAttachment({
      payrollRow: ROW,
      employeeName: 'Budi Santoso',
      brandName: 'Funkydak',
      brandId: 'BR-001',
      payrollPeriod: '2026-09'
    });
    expect(filename).toBe('Slip-Gaji-2026-09-Budi-Santoso.pdf');
    expect(Buffer.isBuffer(content)).toBe(true);
    expect(content.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(content.length).toBeGreaterThan(300);
  });

  it('sanitizes employee names with special characters', async () => {
    const { filename } = await buildPayslipPdfAttachment({
      payrollRow: ROW,
      employeeName: 'Sari/Dewi "R" <&>',
      brandName: 'Funkydak',
      brandId: 'BR-001',
      payrollPeriod: '2026-10'
    });
    expect(filename).toBe('Slip-Gaji-2026-10-Sari-Dewi-R.pdf');
  });

  it('resolves via the promise API (no unhandled error path)', async () => {
    const buf = await buildPayslipPdf({
      payrollRow: ROW,
      employeeName: 'X',
      brandName: 'B',
      brandId: 'BR-1',
      payrollPeriod: '2026-10'
    });
    expect(buf.length).toBeGreaterThan(0); // streams deflated — no plain-text assert
  });
});