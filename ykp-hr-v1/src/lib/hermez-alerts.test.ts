import { describe, it, expect } from 'vitest';
import { generateAlerts } from './hermez-alerts';

describe('hermez-alerts generator', () => {
  const base = {
    date: '2026-07-06',
    brand_name: 'Funkydak',
    outlet_id: 'OL-001',
    outlet_name: 'Cilandak',
    staff_late: 0,
    staff_absent: 0,
    staff_leave: 0,
    staff_present: 5,
    incomplete_attendance: 0,
    shift_shortage: 0,
    total_late_minutes: 0,
    payroll_pending_count: 0,
    has_inactive_in_roster: false
  };

  it('emits no alerts when nothing wrong', () => {
    expect(generateAlerts(base, '2026-07-06 22:00:00')).toEqual([]);
  });

  it('emits LATE_THRESHOLD MEDIUM when staff_late > 2', () => {
    const a = generateAlerts({ ...base, staff_late: 3 }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'LATE_THRESHOLD' && x.severity === 'MEDIUM')).toBe(true);
  });

  it('emits ABSENT HIGH when staff_absent > 0', () => {
    const a = generateAlerts({ ...base, staff_absent: 1 }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'ABSENT' && x.severity === 'HIGH')).toBe(true);
  });

  it('emits SHIFT_SHORTAGE HIGH when shortage > 0', () => {
    const a = generateAlerts({ ...base, shift_shortage: 2 }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'SHIFT_SHORTAGE' && x.severity === 'HIGH')).toBe(true);
  });

  it('emits PAYROLL_PENDING HIGH when payroll pending > 0', () => {
    const a = generateAlerts({ ...base, payroll_pending_count: 1 }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'PAYROLL_PENDING' && x.severity === 'HIGH')).toBe(true);
  });

  it('emits INCOMPLETE MEDIUM when incomplete > 1', () => {
    const a = generateAlerts({ ...base, incomplete_attendance: 2 }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'INCOMPLETE' && x.severity === 'MEDIUM')).toBe(true);
  });

  it('emits INACTIVE_IN_ROSTER MEDIUM when has_inactive_in_roster', () => {
    const a = generateAlerts({ ...base, has_inactive_in_roster: true }, '2026-07-06 22:00:00');
    expect(a.some((x) => x.alert_type === 'INACTIVE_IN_ROSTER' && x.severity === 'MEDIUM')).toBe(true);
  });

  it('produces deterministic alert_id so regen is idempotent', () => {
    const a1 = generateAlerts({ ...base, staff_absent: 1 }, '2026-07-06 22:00:00');
    const a2 = generateAlerts({ ...base, staff_absent: 1 }, '2026-07-07 00:00:00');
    expect(a1[0].alert_id).toBe(a2[0].alert_id);
  });
});