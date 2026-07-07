/**
 * HR daily summary generator per brief §7.
 * Pure function over already-loaded arrays; caller writes to hr_daily_summary sheet.
 * No PII: only aggregate counts + issue text.
 */
export interface SummaryInput {
  date: string;
  brand_id: string;
  brand_name: string;
  outlet_id: string;
  outlet_name: string;
  total_staff: number;
  scheduled_staff: number;
  staff_present: number;
  staff_late: number;
  staff_absent: number;
  staff_leave: number;
  incomplete_attendance: number;
  total_late_minutes: number;
  overtime_hours: number;
  shift_shortage: number;
  payroll_issue_count: number;
}

export interface SummaryResult {
  summary_id: string;
  date: string;
  brand_id: string;
  brand_name: string;
  outlet_id: string;
  outlet_name: string;
  total_staff: number;
  scheduled_staff: number;
  staff_present: number;
  staff_late: number;
  staff_absent: number;
  staff_leave: number;
  incomplete_attendance: number;
  total_late_minutes: number;
  overtime_hours: number;
  shift_shortage: number;
  payroll_issue_count: number;
  major_hr_issue: string;
  recommended_action: string;
  alert_level: 'green' | 'yellow' | 'red';
  created_at: string;
}

const LATE_STAFF_THRESHOLD = 2;
const INCOMPLETE_THRESHOLD = 1;
const SHIFT_SHORTAGE_THRESHOLD = 1;

export function buildSummary(input: SummaryInput, now: string): SummaryResult {
  const issues: string[] = [];
  const actions: string[] = [];
  let level: 'green' | 'yellow' | 'red' = 'green';

  if (input.staff_late > LATE_STAFF_THRESHOLD) {
    issues.push(`${input.staff_late} staff telat`);
    actions.push('Briefing SPV, cek shift rule');
    level = 'yellow';
  }
  if (input.staff_absent > 0) {
    issues.push(`${input.staff_absent} staff absen tanpa keterangan`);
    actions.push('Konfirmasi SPV, cek leave request');
    level = level === 'red' ? 'red' : 'yellow';
  }
  if (input.incomplete_attendance > INCOMPLETE_THRESHOLD) {
    issues.push(`${input.incomplete_attendance} staff belum checkout`);
    actions.push('Follow up SPV untuk konfirmasi checkout');
    level = 'yellow';
  }
  if (input.shift_shortage >= SHIFT_SHORTAGE_THRESHOLD) {
    issues.push(`Shift shortage ${input.shift_shortage}`);
    actions.push('Activate backup roster');
    level = 'red';
  }
  if (input.payroll_issue_count > 0) {
    issues.push(`${input.payroll_issue_count} payroll issue pending`);
    actions.push('HR review payroll');
    level = 'red';
  }

  return {
    summary_id: `HRS-${input.outlet_id}-${input.date}`,
    date: input.date,
    brand_id: input.brand_id,
    brand_name: input.brand_name,
    outlet_id: input.outlet_id,
    outlet_name: input.outlet_name,
    total_staff: input.total_staff,
    scheduled_staff: input.scheduled_staff,
    staff_present: input.staff_present,
    staff_late: input.staff_late,
    staff_absent: input.staff_absent,
    staff_leave: input.staff_leave,
    incomplete_attendance: input.incomplete_attendance,
    total_late_minutes: input.total_late_minutes,
    overtime_hours: input.overtime_hours,
    shift_shortage: input.shift_shortage,
    payroll_issue_count: input.payroll_issue_count,
    major_hr_issue: issues.join('; '),
    recommended_action: actions.join('; '),
    alert_level: level,
    created_at: now
  };
}

/** Build text per brief §7 example. */
export function buildSummaryText(r: SummaryResult): string {
  return [
    `${r.brand_name || r.brand_id} — ${r.date}`,
    '',
    `Scheduled Staff: ${r.scheduled_staff}`,
    `Present: ${r.staff_present}`,
    `Late: ${r.staff_late}`,
    `Absent: ${r.staff_absent}`,
    `Incomplete Checkout: ${r.incomplete_attendance}`,
    r.shift_shortage > 0 ? `Shift Shortage: ${r.shift_shortage}` : '',
    r.major_hr_issue ? `Issue: ${r.major_hr_issue}` : '',
    r.recommended_action ? `Action: ${r.recommended_action}` : ''
  ]
    .filter((l) => l !== '')
    .join('\n');
}