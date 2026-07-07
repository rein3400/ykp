/**
 * Payroll engine per brief §6.7.
 *
 * Formula (brief §6.7):
 *   Gross = Basic + Overtime Pay + Bonus + Allowance
 *   Net    = Gross - Attendance Deduction - Penalty
 *            - Cash Advance Deduction - BPJS - Tax - Other Deduction
 *
 * Inputs per employee + period:
 *   - basic_salary, salary_type (MONTHLY/DAILY/SHIFT_BASED/HOURLY)
 *   - join_date (pro-ration if joined mid-period)
 *   - attendance_days, absent_days, paid_leave_days, unpaid_leave_days
 *   - late_minutes, overtime_hours
 *   - adjustments: bonus, penalty, allowance, cash_advance (from hr_adjustment, approved)
 *
 * Rules are configurable via master_payroll_rule + master_lateness_rule per brand/outlet.
 * Pilot V1: default rules, configurable later.
 *
 * Money is integer IDR. Overtime = hourly_rate * 1.5 (or 2.0 on rest day) per brief §6.8.
 */

export interface PayrollInput {
  employee_id: string;
  full_name: string;
  basic_salary: number;
  salary_type: 'MONTHLY' | 'DAILY' | 'SHIFT_BASED' | 'HOURLY';
  join_date: string; // YYYY-MM-DD
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  attendance_days: number;
  absent_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  late_minutes: number;
  overtime_hours: number;
  bonus: number;
  penalty: number;
  allowance: number;
  cash_advance: number;
  bpjs_deduction: number;
  tax_deduction: number;
  other_deduction: number;
}

export interface PayrollResult {
  basic_salary: number;
  attendance_deduction: number;
  overtime_pay: number;
  bonus_total: number;
  penalty_total: number;
  allowance_total: number;
  cash_advance_deduction: number;
  gross_salary: number;
  net_salary: number;
  proRated: boolean;
  effective_days: number;
}

/** Days in a period inclusive. */
export function periodDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

/** Effective days: clamp to days the employee was actually employed. */
export function effectiveDays(input: Pick<PayrollInput, 'join_date' | 'period_start' | 'period_end'>): number {
  const join = new Date(input.join_date + 'T00:00:00Z');
  const ps = new Date(input.period_start + 'T00:00:00Z');
  const pe = new Date(input.period_end + 'T00:00:00Z');
  const start = join > ps ? join : ps;
  if (start > pe) return 0;
  return periodDays(start.toISOString().slice(0, 10), input.period_end);
}

/** Hourly rate derived from salary_type + basic. Default 28 working days/month, 8h/day. */
export function hourlyRate(basic: number, type: string): number {
  if (type === 'HOURLY') return basic;
  if (type === 'DAILY') return Math.round(basic / 8);
  if (type === 'SHIFT_BASED') return Math.round(basic / 8);
  // MONTHLY
  const monthlyHours = 28 * 8; // 224
  return Math.round(basic / monthlyHours);
}

/** Attendance deduction = (absent_days + unpaid_leave_days) * daily_rate. */
export function attendanceDeduction(input: PayrollInput): number {
  const daily = Math.round(hourlyRate(input.basic_salary, input.salary_type) * 8);
  return (input.absent_days + input.unpaid_leave_days) * daily;
}

/** Late deduction = payable_late_minutes * amount_per_minute (lateness rule). */
export function lateDeduction(late_minutes: number, amountPerMinute: number): number {
  return late_minutes * amountPerMinute;
}

/** Overtime pay = overtime_hours * hourly * 1.5. */
export function overtimePay(input: PayrollInput): number {
  const rate = hourlyRate(input.basic_salary, input.salary_type);
  return Math.round(input.overtime_hours * rate * 1.5);
}

export function computePayroll(input: PayrollInput): PayrollResult {
  const eff = effectiveDays(input);
  const totalDays = periodDays(input.period_start, input.period_end);
  const proRated = eff < totalDays;

  // Basic salary prorated for the period the employee was active.
  const proratedBasic = proRated ? Math.round((input.basic_salary * eff) / totalDays) : input.basic_salary;

  const attDeduction = attendanceDeduction(input);
  const otPay = overtimePay(input);

  const gross = proratedBasic + otPay + input.bonus + input.allowance;
  const net =
    gross -
    attDeduction -
    input.penalty -
    input.cash_advance -
    input.bpjs_deduction -
    input.tax_deduction -
    input.other_deduction;

  return {
    basic_salary: proratedBasic,
    attendance_deduction: attDeduction,
    overtime_pay: otPay,
    bonus_total: input.bonus,
    penalty_total: input.penalty,
    allowance_total: input.allowance,
    cash_advance_deduction: input.cash_advance,
    gross_salary: gross,
    net_salary: Math.max(0, net),
    proRated,
    effective_days: eff
  };
}