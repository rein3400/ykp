import { describe, it, expect } from 'vitest';
import { buildSummary } from './summary';

describe('summary engine', () => {
  it('green when nothing wrong', () => {
    const r = buildSummary({
      date: '2026-07-06',
      brand_id: 'BR-001',
      brand_name: 'Funkydak',
      outlet_id: 'OL-001',
      outlet_name: 'Cilandak',
      total_staff: 10,
      scheduled_staff: 8,
      staff_present: 8,
      staff_late: 0,
      staff_absent: 0,
      staff_leave: 0,
      incomplete_attendance: 0,
      total_late_minutes: 0,
      overtime_hours: 0,
      shift_shortage: 0,
      payroll_issue_count: 0
    }, '2026-07-06 22:00:00');
    expect(r.alert_level).toBe('green');
    expect(r.major_hr_issue).toBe('');
  });

  it('yellow when more than 2 late', () => {
    const r = buildSummary({
      date: '2026-07-06',
      brand_id: 'BR-001',
      brand_name: 'Funkydak',
      outlet_id: 'OL-001',
      outlet_name: 'Cilandak',
      total_staff: 10,
      scheduled_staff: 8,
      staff_present: 8,
      staff_late: 3,
      staff_absent: 0,
      staff_leave: 0,
      incomplete_attendance: 0,
      total_late_minutes: 45,
      overtime_hours: 0,
      shift_shortage: 0,
      payroll_issue_count: 0
    }, '2026-07-06 22:00:00');
    expect(r.alert_level).toBe('yellow');
    expect(r.major_hr_issue).toContain('3 staff telat');
  });

  it('red on shift shortage', () => {
    const r = buildSummary({
      date: '2026-07-06',
      brand_id: 'BR-001',
      brand_name: 'Funkydak',
      outlet_id: 'OL-001',
      outlet_name: 'Cilandak',
      total_staff: 10,
      scheduled_staff: 7,
      staff_present: 7,
      staff_late: 0,
      staff_absent: 0,
      staff_leave: 0,
      incomplete_attendance: 0,
      total_late_minutes: 0,
      overtime_hours: 0,
      shift_shortage: 1,
      payroll_issue_count: 0
    }, '2026-07-06 22:00:00');
    expect(r.alert_level).toBe('red');
  });
});
