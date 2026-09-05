/**
 * Probation & contract reminders — MOM 1 Sep 2026 §2.
 *
 * Ladder: Probation 2 bulan → Kontrak 1 tahun → Karyawan tetap
 * (total 14 bulan). System reminds HR/Owner as probation-end and
 * pre-contract-end approach. No contract-file upload (archive only).
 *
 * Pure date math lives here (unit-tested); the notify route wires it to
 * Telegram. All dates are YYYY-MM-DD (Asia/Jakarta calendar days).
 */

export interface EmployeeLite {
  employee_id: string;
  full_name: string;
  join_date: string;
  employment_status: string;
}

export type ReminderKind = 'PROBATION_END' | 'CONTRACT_END';

export interface Reminder {
  employee_id: string;
  full_name: string;
  kind: ReminderKind;
  /** YYYY-MM-DD deadline */
  dueDate: string;
  /** negative = overdue */
  daysLeft: number;
  overdue: boolean;
}

export const PROBATION_MONTHS = 2;
export const CONTRACT_TOTAL_MONTHS = 14;

function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add calendar months, clamping end-of-month (31 Jan + 1mo = 28/29 Feb). */
export function addMonths(day: string, n: number): string | null {
  const d = parseDay(day);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const dd = d.getUTCDate();
  const target = new Date(Date.UTC(y, mo + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(dd, lastDay));
  return toDay(target);
}

/** Whole calendar days from `from` to `to` (to - from). */
export function diffDays(from: string, to: string): number | null {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface ReminderOptions {
  probationMonths?: number;
  contractTotalMonths?: number;
  /** remind when daysLeft <= max(warnDays) */
  warnDays?: number[];
  /** keep reminding this long after the deadline */
  overdueGraceDays?: number;
}

/**
 * Compute due reminders for one snapshot day. Deterministic & side-effect free.
 */
export function contractReminders(
  employees: EmployeeLite[],
  today: string,
  opts: ReminderOptions = {}
): Reminder[] {
  const probationMonths = opts.probationMonths ?? PROBATION_MONTHS;
  const contractTotalMonths = opts.contractTotalMonths ?? CONTRACT_TOTAL_MONTHS;
  const warnDays = opts.warnDays ?? [14, 7];
  const grace = opts.overdueGraceDays ?? 30;
  const maxWarn = Math.max(...warnDays);
  const out: Reminder[] = [];

  for (const e of employees) {
    const status = (e.employment_status || '').trim().toUpperCase();
    let kind: ReminderKind | null = null;
    let months: number | null = null;
    if (status === 'PROBATION' || status === 'PERCOBAAN' || status === 'MASA PERCOBAAN') {
      kind = 'PROBATION_END';
      months = probationMonths;
    } else if (status === 'CONTRACT' || status === 'KONTRAK' || status === 'PKWT') {
      kind = 'CONTRACT_END';
      months = contractTotalMonths;
    } else {
      continue; // PERMANENT / TETAP / empty → no reminder
    }
    const due = addMonths(e.join_date, months);
    if (!due || !kind) continue;
    const daysLeft = diffDays(today, due);
    if (daysLeft === null) continue;
    if (daysLeft > maxWarn || daysLeft < -grace) continue;
    out.push({
      employee_id: e.employee_id,
      full_name: e.full_name,
      kind,
      dueDate: due,
      daysLeft,
      overdue: daysLeft < 0
    });
  }
  out.sort((a, b) => a.daysLeft - b.daysLeft);
  return out;
}

/** Human-readable Telegram body for a reminder batch. */
export function composeReminderText(date: string, items: Reminder[]): string {
  const lines = items.map((r) => {
    const what = r.kind === 'PROBATION_END' ? 'Probation berakhir' : 'Kontrak berakhir';
    const when = r.overdue
      ? `LEWAT ${Math.abs(r.daysLeft)} hari`
      : r.daysLeft === 0
        ? 'HARI INI'
        : `H-${r.daysLeft}`;
    return `- ${r.full_name} (${r.employee_id}): ${what} ${r.dueDate} [${when}]`;
  });
  return [
    `<b>Reminder Kontrak/Probation — ${date}</b>`,
    `${items.length} karyawan perlu perhatian:`,
    ...lines,
    '',
    'Cek modul HR → Employees untuk tindak lanjut.'
  ].join('\n');
}
