/**
 * @ykp/engine/attendance
 *
 * Pure time helpers used by the HR app, the daily summary generator,
 * and the Hermez lateStaffTrigger. All inputs are wall-clock times in
 * the outlet's timezone (WIB). Tolerance and cap parameters come from
 * hr_rules and are passed by the caller.
 */

/** Result of a late-evaluation check. */
export interface LateResult {
  is_late: boolean;
  /** Minutes late AFTER tolerance has been deducted. */
  late_minutes: number;
}

/**
 * Compute lateness given an actual check-in and a scheduled shift start.
 *
 *   - `shift_start` is a HH:mm string (e.g. "09:00").
 *   - `check_in` is a Date; only its HH:mm component matters.
 *   - `tolerance_min` is the grace window (e.g. 15).
 *
 * If `check_in` falls before `shift_start + tolerance`, the staff is on
 * time. Otherwise `late_minutes` reports the difference from the shift
 * start (NOT from the end of the tolerance window) so the payroll engine
 * can penalise on the *actual* overrun.
 */
export function computeLate(
  check_in: Date,
  shift_start: string,
  tolerance_min: number,
): LateResult {
  const [h, m] = shift_start.split(":").map((x) => Number.parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`computeLate: invalid shift_start "${shift_start}"`);
  }
  const ci = check_in.getHours() * 60 + check_in.getMinutes();
  const shiftMinutes = h * 60 + m;
  let diff = ci - shiftMinutes;
  // Cross-midnight shift: shift_start wraps the boundary, so a check-in
  // in the small hours of the morning belongs to the previous day's
  // shift. Normalise a large negative delta back into the shift window.
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff <= tolerance_min) {
    return { is_late: false, late_minutes: 0 };
  }
  return { is_late: true, late_minutes: diff };
}

/** Result of an overtime computation. */
export interface OvertimeResult {
  overtime_hours: number;
}

/**
 * Compute overtime hours based on checkout vs scheduled shift end.
 * If checkout is before shift end, overtime is 0. Negative deltas are
 * clamped to zero; the caller decides whether to flag early leave.
 */
export function computeOvertime(check_out: Date, shift_end: string): OvertimeResult {
  const [h, m] = shift_end.split(":").map((x) => Number.parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`computeOvertime: invalid shift_end "${shift_end}"`);
  }
  const co = check_out.getHours() * 60 + check_out.getMinutes();
  const shiftMinutes = h * 60 + m;
  let diffMin = co - shiftMinutes;
  // Cross-midnight shift: a checkout after midnight belongs to the shift
  // that ended earlier that day. Normalise a large negative delta.
  if (diffMin < -12 * 60) diffMin += 24 * 60;
  if (diffMin <= 0) {
    return { overtime_hours: 0 };
  }
  const hours = Math.round((diffMin / 60) * 100) / 100;
  return { overtime_hours: hours };
}

/**
 * Detect early leave: did the staff clock out BEFORE the scheduled
 * shift end? The caller passes the same `shift_end` string used in
 * `computeOvertime`. Date itself is not relevant; the function
 * compares HH:mm components.
 */
export function computeEarlyLeave(check_out: Date, shift_end: string): { is_early_leave: boolean } {
  const [h, m] = shift_end.split(":").map((x) => Number.parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`computeEarlyLeave: invalid shift_end "${shift_end}"`);
  }
  const co = check_out.getHours() * 60 + check_out.getMinutes();
  const shiftMinutes = h * 60 + m;
  // Cross-midnight shifts: don't flag checkout-before-shift_end as early
  // leave when the shift wraps midnight (those shifts are early-morning
  // end-of-day, e.g. 22:00 -> 06:00).
  const wrapsMidnight = shiftMinutes <= 12 * 60; // end before noon -> shift likely wraps
  if (wrapsMidnight && co < shiftMinutes) return { is_early_leave: false };
  return { is_early_leave: co < shiftMinutes };
}