import { describe, it, expect } from 'vitest';
import { computePayroll, effectiveDays, periodDays, hourlyRate, attendanceDeduction, overtimePay } from './payroll';

describe('payroll engine', () => {
  const baseInput = {
    employee_id: 'EMP-001',
    full_name: 'Ayu',
    basic_salary: 4_500_000,
    salary_type: 'MONTHLY' as const,
    join_date: '2026-07-01',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    attendance_days: 26,
    absent_days: 0,
    paid_leave_days: 0,
    unpaid_leave_days: 0,
    late_minutes: 0,
    overtime_hours: 0,
    bonus: 0,
    penalty: 0,
    allowance: 0,
    cash_advance: 0,
    bpjs_deduction: 0,
    tax_deduction: 0,
    other_deduction: 0
  };

  it('full month monthly salary', () => {
    const r = computePayroll(baseInput);
    expect(r.basic_salary).toBe(4_500_000);
    expect(r.gross_salary).toBe(4_500_000);
    expect(r.net_salary).toBe(4_500_000);
  });

  it('prorates when join date is mid-period', () => {
    const r = computePayroll({ ...baseInput, join_date: '2026-07-15' });
    expect(r.proRated).toBe(true);
    expect(r.effective_days).toBe(17);
    expect(r.basic_salary).toBe(Math.round((4_500_000 * 17) / 31));
  });

  it('deducts attendance for absent days', () => {
    const r = computePayroll({ ...baseInput, absent_days: 2 });
    const daily = hourlyRate(baseInput.basic_salary, 'MONTHLY') * 8;
    expect(r.attendance_deduction).toBe(2 * daily);
    expect(r.net_salary).toBe(r.gross_salary - r.attendance_deduction);
  });

  it('pays overtime at 1.5x hourly', () => {
    const r = computePayroll({ ...baseInput, overtime_hours: 10 });
    const hourly = hourlyRate(baseInput.basic_salary, 'MONTHLY');
    expect(r.overtime_pay).toBe(Math.round(10 * hourly * 1.5));
    expect(r.gross_salary).toBe(baseInput.basic_salary + r.overtime_pay);
  });
});
