/**
 * Pure timezone/date helpers — no Node-only deps, safe for client bundles.
 * All YKP data lives in Asia/Jakarta (WIB). Dates are `YYYY-MM-DD` strings.
 */

/** Returns today's date in Asia/Jakarta as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/** Add N days (may be negative) to a YYYY-MM-DD string. Pure calendar math. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (to - from). Negative if `to` < `from`. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Inclusive list of N dates ending at `end` (default: today WIB), oldest first. */
export function lastNDays(n: number, end: string = todayWib()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** YYYY-MM of a date string. */
export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Previous YYYY-MM. */
export function prevMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return dt.toISOString().slice(0, 7);
}

/** Age in days of an invoice/due date relative to `onDate`. 0 when not yet due. */
export function overdueDays(dueDate: string, onDate: string): number {
  return Math.max(0, daysBetween(dueDate, onDate));
}
