/**
 * Generate payroll for a YYYY-MM period.
 * Reads: employees, attendance, adjustments, lateness_rules
 * Writes: hr_payroll with status PENDING
 */
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, ok } from '@/lib/http';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { computePayroll, type PayrollInput, periodDays, attendanceDeduction, overtimePay, hourlyRate } from '@/features/hr/lib/payroll';
import { z } from 'zod';

const schema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) });

interface Employee {
  employee_id: string;
  full_name: string;
  basic_salary: string;
  salary_type: string;
  join_date: string;
  brand_id: string;
  outlet_id: string;
  active_status: string;
}
interface Attendance {
  attendance_id: string;
  employee_id: string;
  date: string;
  attendance_status: string;
  late_minutes: string;
  overtime_minutes: string;
  actual_check_in: string;
  actual_check_out: string;
}
interface Leave {
  employee_id: string;
  start_date: string;
  end_date: string;
  approval_status: string;
  leave_type: string;
}
interface Adjustment {
  employee_id: string;
  adjustment_type: string;
  amount: string;
  approval_status: string;
  payroll_period: string;
}
interface LatenessRule {
  amount_per_minute: string;
  active_status: string;
}

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'generate', 'payroll')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const [yy, mm] = parsed.data.period.split('-').map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const periodStart = `${parsed.data.period}-01`;
  const periodEnd = `${parsed.data.period}-${String(lastDay).padStart(2, '0')}`;

  const [employees, attendance, leaves, adjustments, rules] = await Promise.all([
    readTab<Employee>(TABS.employees),
    readTab<Attendance>(TABS.attendance),
    readTab<Leave>(TABS.leaves),
    readTab<Adjustment>(TABS.adjustments),
    readTab<LatenessRule>(TABS.latenessRules)
  ]);
  const rule = rules.find((r) => r.active_status === 'active') ?? rules[0];
  const amountPerMinute = Number(rule?.amount_per_minute ?? 5000);

  const totalDays = periodDays(periodStart, periodEnd);
  const rows: Record<string, string>[] = [];
  const now = nowTimestampWib();

  for (const e of employees) {
    if (e.active_status !== 'active' && e.active_status !== '1') continue;
    if (!e.join_date) continue;

    const attInPeriod = attendance.filter(
      (a) => a.employee_id === e.employee_id && a.date >= periodStart && a.date <= periodEnd
    );
    const presentDays = attInPeriod.filter(
      (a) => a.attendance_status === 'PRESENT' || a.attendance_status === 'LATE'
    ).length;
    const lateDays = attInPeriod.filter((a) => a.attendance_status === 'LATE').length;
    const absentDays = attInPeriod.filter((a) => a.attendance_status === 'ABSENT').length;

    const lateMinutes = attInPeriod.reduce((s, a) => s + Number(a.late_minutes || 0), 0);
    const overtimeHours = Math.round(
      attInPeriod.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0) / 60
    );

    const approvedLeaves = leaves.filter(
      (l) => l.employee_id === e.employee_id && l.approval_status === 'APPROVED'
    );
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    for (const l of approvedLeaves) {
      const s = new Date(Math.max(new Date(l.start_date).getTime(), new Date(periodStart).getTime()));
      const end = new Date(Math.min(new Date(l.end_date).getTime(), new Date(periodEnd).getTime()));
      const days = Math.max(0, Math.round((end.getTime() - s.getTime()) / 86400000) + 1);
      if (['ANNUAL_LEAVE', 'MATERNITY'].includes(l.leave_type)) paidLeaveDays += days;
      else if (['SICK'].includes(l.leave_type)) paidLeaveDays += days;
      else if (['PERMISSION', 'UNPAID_LEAVE'].includes(l.leave_type)) unpaidLeaveDays += days;
      else if (['EMERGENCY'].includes(l.leave_type)) paidLeaveDays += days;
    }

    const empAdj = adjustments.filter(
      (a) => a.employee_id === e.employee_id && a.approval_status === 'APPROVED' && a.payroll_period === parsed.data.period
    );
    const bonus = empAdj.filter((a) => a.adjustment_type === 'BONUS').reduce((s, a) => s + Number(a.amount), 0);
    const penalty = empAdj.filter((a) => a.adjustment_type === 'PENALTY').reduce((s, a) => s + Number(a.amount), 0);
    const allowance = empAdj.filter((a) => a.adjustment_type === 'ALLOWANCE').reduce((s, a) => s + Number(a.amount), 0);
    const cashAdvance = empAdj.filter((a) => a.adjustment_type === 'CASH_ADVANCE').reduce((s, a) => s + Number(a.amount), 0);
    const overtime = empAdj.filter((a) => a.adjustment_type === 'OVERTIME').reduce((s, a) => s + Number(a.amount), 0);
    const reimburse = empAdj.filter((a) => a.adjustment_type === 'REIMBURSEMENT').reduce((s, a) => s + Number(a.amount), 0);
    const other = empAdj.filter((a) => !['BONUS', 'PENALTY', 'ALLOWANCE', 'CASH_ADVANCE', 'OVERTIME', 'REIMBURSEMENT'].includes(a.adjustment_type)).reduce((s, a) => s + Number(a.amount), 0);

    const input: PayrollInput = {
      employee_id: e.employee_id,
      full_name: e.full_name,
      basic_salary: Number(e.basic_salary || 0),
      salary_type: (e.salary_type as any) || 'MONTHLY',
      join_date: e.join_date,
      period_start: periodStart,
      period_end: periodEnd,
      attendance_days: presentDays,
      absent_days: absentDays,
      paid_leave_days: paidLeaveDays,
      unpaid_leave_days: unpaidLeaveDays,
      late_minutes: lateMinutes,
      overtime_hours: overtimeHours,
      bonus: bonus + overtime + reimburse,
      penalty: penalty,
      allowance: allowance,
      cash_advance: cashAdvance,
      bpjs_deduction: 0,
      tax_deduction: 0,
      other_deduction: other
    };
    const result = computePayroll(input);

    const payrollId = `PR-${e.employee_id}-${parsed.data.period}`;
    rows.push({
      payroll_id: payrollId,
      payroll_period: parsed.data.period,
      employee_id: e.employee_id,
      employee_name: e.full_name,
      brand_id: e.brand_id,
      outlet_id: e.outlet_id,
      basic_salary: String(result.basic_salary),
      attendance_days: String(presentDays),
      absent_days: String(absentDays),
      paid_leave_days: String(paidLeaveDays),
      unpaid_leave_days: String(unpaidLeaveDays),
      late_minutes: String(lateMinutes),
      attendance_deduction: String(result.attendance_deduction),
      overtime_hours: String(overtimeHours),
      overtime_pay: String(result.overtime_pay),
      bonus_total: String(result.bonus_total),
      penalty_total: String(result.penalty_total),
      allowance_total: String(result.allowance_total),
      cash_advance_deduction: String(result.cash_advance_deduction),
      bpjs_deduction: '0',
      tax_deduction: '0',
      other_deduction: String(other),
      gross_salary: String(result.gross_salary),
      net_salary: String(result.net_salary),
      calculation_status: 'FINAL',
      approval_status: 'PENDING',
      payment_status: 'UNPAID',
      payment_date: '',
      payment_reference: '',
      payslip_url: '',
      approved_by: '',
      created_at: now,
      updated_at: now
    });
  }

  if (rows.length > 0) {
    await appendRows(TABS.payroll, rows);
  }

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'generate',
    entity: 'payroll',
    entityId: parsed.data.period,
    afterValue: `${rows.length} rows`
  });

  return ok({ period: parsed.data.period, count: rows.length });
});
