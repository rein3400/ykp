/**
 * Bounded attendance lookups — shared by the Telegram webhook and the
 * attendance service so both resolve employee-by-chat-id and today's
 * attendance row through ONE read per tab (not a full scan per call site).
 *
 * Sheets API has no server-side WHERE, so every lookup is a full-tab read
 * followed by a client-side filter. The win here is consolidation: each
 * webhook call reads each relevant tab at most once, and the filters are
 * pure + unit-testable.
 *
 * Scalability note: for very large headcount (thousands+), the per-call full
 * tab read is the bottleneck (Sheets read quota, not CPU). In-memory caching
 * of the employee→telegram-id index (refreshed periodically) is the next
 * step if pilot volume exceeds the 60 reads/min Sheets quota. This module
 * is the single place to add that cache later.
 */
import { readTab, TABS, findRow, type TabName } from '@/db/sheets';

/** Employee row shape used by the attendance flow. */
export interface EmployeeRow {
  employee_id: string;
  telegram_id: string;
  full_name: string;
  outlet_id: string;
  brand_id: string;
  [k: string]: string;
}

/** Attendance row shape used for idempotency + open-row lookup. */
export interface AttendanceRow {
  attendance_id: string;
  date: string;
  employee_id: string;
  actual_check_in: string;
  actual_check_out: string;
  [k: string]: string;
}

/**
 * Find an employee by Telegram chat id.
 *
 * Reads the master_employee tab once and filters by `telegram_id`. The
 * `telegram_id` column (index 7) is trimmed and compared as a string so
 * chat ids sent by Telegram (number) match ids stored in Sheets (string).
 *
 * Returns null when the chat id is not linked to any employee — the webhook
 * then asks the user to contact HR admin to link their Telegram ID.
 */
export async function findEmployeeByTelegramId(chatId: number | string): Promise<EmployeeRow | null> {
  const id = String(chatId).trim();
  if (!id) return null;
  const rows = await readTab<EmployeeRow>(TABS.employees);
  // Iterate from the end — recently onboarded employees are more likely to
  // absen, and the last rows are the most recently appended.
  for (let i = rows.length - 1; i >= 0; i--) {
    if ((rows[i].telegram_id ?? '').trim() === id) return rows[i];
  }
  return null;
}

/**
 * Find today's attendance row for an employee (idempotency check).
 *
 * Returns the row when the employee has already clocked in today (has
 * `actual_check_in`), so the caller can return `already:true` instead of
 * appending a duplicate. Returns null when no row exists for today, or when
 * a row exists but `actual_check_in` is empty (a half-created row — treated
 * as "not yet clocked in", so the caller can fill it).
 *
 * Reads the attendance tab once and filters by (date, employee_id). For
 * scale, iterating from the end is preferred because today's rows are the
 * most recently appended.
 */
export async function findTodayAttendance(
  employeeId: string,
  date: string
): Promise<AttendanceRow | null> {
  if (!employeeId || !date) return null;
  const rows = await readTab<AttendanceRow>(TABS.attendance);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.date === date && r.employee_id === employeeId) return r;
  }
  return null;
}

/**
 * Find the open attendance row for an employee — a row with `actual_check_in`
 * set and `actual_check_out` empty. Used by the clock-out flow to locate the
 * row to update without scanning the full tab in the webhook.
 *
 * Returns null when no open row exists (employee hasn't clocked in today, or
 * already clocked out). Iterates from the end because the open row is the
 * most recently appended for that employee.
 */
export async function findOpenAttendance(employeeId: string): Promise<AttendanceRow | null> {
  if (!employeeId) return null;
  const rows = await readTab<AttendanceRow>(TABS.attendance);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (
      r.employee_id === employeeId &&
      r.actual_check_in &&
      !r.actual_check_out
    ) {
      return r;
    }
  }
  return null;
}

/**
 * Find today's roster entry for an employee. Returns the row (with shift_id)
 * or null when the employee is not rostered today (no shift — treated as
 * unscheduled, no lateness penalty).
 */
export async function findTodayRoster(
  employeeId: string,
  date: string
): Promise<{ shift_id: string; [k: string]: string } | null> {
  if (!employeeId || !date) return null;
  const rows = await readTab<{ shift_id: string; employee_id: string; date: string }>(TABS.roster);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.date === date && r.employee_id === employeeId) return r as { shift_id: string; [k: string]: string };
  }
  return null;
}

/**
 * Find the active lateness rule for an outlet.
 *
 * Filters by `outlet_id` and `active_status === 'active'` (or non-empty).
 * Falls back to the first rule whose `outlet_id` is empty (a global default
 * rule, by convention) when no outlet-specific rule exists. Returns null
 * when neither exists — the caller applies a hardcoded default tolerance.
 *
 * The previous behavior fell back to `rules[0]` (an arbitrary rule, possibly
 * for a different outlet), which could apply the wrong penalty to employees.
 */
export async function findLatenessRule(
  outletId: string
): Promise<{ tolerance_minutes: string; [k: string]: string } | null> {
  const rows = await readTab<{ outlet_id: string; tolerance_minutes: string; active_status: string }>(TABS.latenessRules);
  if (rows.length === 0) return null;
  let globalDefault: { tolerance_minutes: string; [k: string]: string } | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const active = (r.active_status ?? '').toLowerCase();
    if (active && active !== 'active') continue;
    if (r.outlet_id === outletId) return r as { tolerance_minutes: string; [k: string]: string };
    if (!globalDefault && !r.outlet_id) {
      globalDefault = r as { tolerance_minutes: string; [k: string]: string };
    }
  }
  return globalDefault;
}

/** Resolve the linked user account (users.employee_id) for an employee. */
export async function findUserByEmployeeId(
  employeeId: string
): Promise<{ user_id: string; role: string; [k: string]: string } | null> {
  if (!employeeId) return null;
  const r = await findRow(TABS.users, 'employee_id', employeeId);
  return r ? (r.row as { user_id: string; role: string; [k: string]: string }) : null;
}

/** Re-export TabName for callers that type their own lookups. */
export type { TabName };