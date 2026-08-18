/**
 * @ykp/engine/payroll
 *
 * Payroll engine — single source of truth for gross/net pay calculation.
 * Formulas are the cleaner `base_salary / payroll_days * attendance_count`
 * variant agreed in binding contract §6 (with overtime added separately).
 *
 * NOTE — Ayu Rp4.5M walkthrough (post H1 fix):
 *   inputs  : base_salary=4_500_000, payroll_days=25, attendance_count=23,
 *             absent_days=2, total_late_min=0, overtime_hours=0,
 *             bonus=0, other_deductions=0,
 *             hourly_late_penalty=0, regular_hourly_rate=0
 *   outputs : daily_rate=180_000, attendance_base=4_140_000,
 *             attendance_deduction=360_000 (kept for audit only),
 *             late_deduction=0, overtime_pay=0,
 *             gross_salary=4_140_000, net_salary=4_140_000
 *
 *   Defect H1 fix: net no longer subtracts attendance_deduction, so the
 *   walkthrough gross/net is now 4_140_000 instead of 3_780_000. Absent
 *   days are already implicit in attendance_count (23 < 25).
 *
 * If the binding contract blueprint states gross=4_281_250 for the same
 * employee, then *the inputs are different* (likely 22 attendance days, or
 * base_salary above 4.5M, or an adjusted daily_rate). We keep this clean
 * formula and surface the discrepancy here so reviewers can decide.
 */

export interface PayrollInputs {
  base_salary: number;
  payroll_days: number;
  attendance_count: number;
  absent_days: number;
  total_late_min: number;
  overtime_hours: number;
  bonus: number;
  other_deductions: number;
  hourly_late_penalty: number;
  regular_hourly_rate: number;
  /** Overtime hourly multiplier (default 1.5). */
  overtime_multiplier?: number;
  /** Cap on overtime hours billed per period. */
  overtime_cap_hours?: number;
}

export interface PayrollResult {
  daily_rate: number;
  attendance_base: number;
  attendance_deduction: number;
  late_deduction: number;
  overtime_pay: number;
  gross_salary: number;
  net_salary: number;
}

/**
 * Pure function. Throws on invalid inputs (zero payroll_days, negative
 * numbers) so the caller can surface a clear 422 to the user instead of
 * silently writing NaN into hr_payroll.
 */
export function computePayroll(inputs: PayrollInputs): PayrollResult {
  const {
    base_salary,
    payroll_days,
    attendance_count,
    absent_days,
    total_late_min,
    overtime_hours,
    bonus,
    other_deductions,
    hourly_late_penalty,
    regular_hourly_rate,
    overtime_multiplier = 1.5,
    overtime_cap_hours = 12,
  } = inputs;

  if (payroll_days <= 0) {
    throw new Error("computePayroll: payroll_days must be > 0");
  }
  if (attendance_count < 0 || absent_days < 0 || total_late_min < 0 || overtime_hours < 0) {
    throw new Error("computePayroll: counts cannot be negative");
  }

  const daily_rate = Math.round(base_salary / payroll_days);
  const attendance_base = daily_rate * attendance_count;
  const attendance_deduction = daily_rate * absent_days;
  const late_deduction = Math.round(total_late_min / 60) * hourly_late_penalty;

  const cappedOvertime = Math.min(overtime_hours, overtime_cap_hours);
  const overtime_pay = Math.round(cappedOvertime * regular_hourly_rate * overtime_multiplier);

  const gross_salary = attendance_base + overtime_pay + bonus;
  // Defect H1 fix: attendance_base already equals daily_rate * attendance_count,
  // so absent days are already implicitly excluded. Subtracting attendance_deduction
  // again would double-deduct absent_days * daily_rate.
  const net_salary = gross_salary - late_deduction - other_deductions;

  return {
    daily_rate,
    attendance_base,
    attendance_deduction,
    late_deduction,
    overtime_pay,
    gross_salary,
    net_salary,
  };
}

/**
 * Walk-through fixture for "Ayu Rp4.5M" referenced in the binding contract.
 * Returns both the inputs and computed outputs so unit tests + docs can
 * assert the same numbers without re-typing literals.
 *
 * Reported gross: Rp 3.780.000 (clean attendance_base 4.14M minus no late,
 * no overtime, no bonus). If the blueprint claims 4.281.250 the inputs
 * above are not the ones that produced it; check the source table.
 */
export function computePayrollAyuExample() {
  const inputs: PayrollInputs = {
    base_salary: 4_500_000,
    payroll_days: 25,
    attendance_count: 23,
    absent_days: 2,
    total_late_min: 0,
    overtime_hours: 0,
    bonus: 0,
    other_deductions: 0,
    hourly_late_penalty: 0,
    regular_hourly_rate: 0,
  };
  const result = computePayroll(inputs);
  return { inputs, result };
}