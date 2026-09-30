import { describe, it, expect, beforeEach } from 'vitest';
import { performClockIn, performClockOut, computeLateMinutes, computeOvertimeMinutes } from './attendance-service';

// Force the in-memory mock DB so these tests exercise the real write path
// (assertEmployee, geofence, roster/shift lookup, append/update) without
// needing Google credentials.
process.env.USE_MOCK_DB = 'true';
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.YKP_HR_SPREADSHEET_ID;

describe('computeOvertimeMinutes', () => {
  it('counts minutes after scheduled shift end', () => {
    expect(computeOvertimeMinutes('09:00', '16:00', '16:00')).toBe(0);
    expect(computeOvertimeMinutes('09:00', '16:00', '16:35')).toBe(35);
  });

  it('handles an overnight shift', () => {
    expect(computeOvertimeMinutes('16:00', '23:00', '23:45')).toBe(45);
    expect(computeOvertimeMinutes('20:00', '04:00', '04:30')).toBe(30);
  });
});

describe('computeLateMinutes', () => {
  it('returns 0 when on time or within tolerance', () => {
    expect(computeLateMinutes('07:00', '07:00', 10)).toBe(0);
    expect(computeLateMinutes('07:00', '07:09', 10)).toBe(0);
  });

  it('subtracts tolerance for late check-ins', () => {
    expect(computeLateMinutes('07:00', '07:25', 10)).toBe(15);
  });
});

describe('performClockIn / performClockOut (mock store)', () => {
  // Mock store is seeded fresh per process (globalThis keyed store). Use the
  // demo employee EMP-005 (Rizky, OL-001) who has no attendance row today.
  const employeeId = 'EMP-005';

  beforeEach(() => {
    // The mock store persists across tests in the same process; a second
    // clock-in for the same employee+date is idempotent (already:true), so
    // each test below still asserts its own contract.
  });

  it('requires GPS for Telegram clock-in by employee', async () => {
    const r = await performClockIn({
      employeeId,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId },
      source: 'telegram'
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('gps_required');
  });

  it('allows a web clock-in without Telegram GPS flow', async () => {
    const r = await performClockIn({
      employeeId,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId },
      source: 'web'
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.employee_id).toBe(employeeId);
    expect(r.row.actual_check_in).toMatch(/^\d{2}:\d{2}$/);
    expect(['PRESENT', 'LATE']).toContain(r.row.attendance_status);
  });

  it('rejects a second clock-in as idempotent (already:true), not an error', async () => {
    const first = await performClockIn({
      employeeId,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId },
      source: 'web'
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await performClockIn({
      employeeId,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId },
      source: 'telegram'
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.already).toBe(true);
  });

  it('rejects an out-of-radius location', async () => {
    // EMP-011 (Intan Permata) is at OL-003 (Laju Kopi Tebet, radius 150m) and
    // has no attendance row today in the seed, so the geofence path runs.
    const r = await performClockIn({
      employeeId: 'EMP-011',
      latitude: -6.1000,
      longitude: 106.6000,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId: 'EMP-011' },
      source: 'telegram'
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.status).toBe(400);
      expect(r.error.message).toContain('luar radius');
    }
  });

  it('clocks out an open attendance row', async () => {
    // EMP-005 is already clocked in from the earlier tests in this process.
    const open = await performClockIn({
      employeeId: 'EMP-006', // Dian Prasetyo, OL-002 — no open row today
      actor: { userId: 'USR-TEST', role: 'employee', employeeId: 'EMP-006' },
      source: 'web'
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    const missingGps = await performClockOut({
      attendanceId: open.row.attendance_id,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId: 'EMP-006' },
      source: 'telegram'
    });
    expect(missingGps.ok).toBe(false);
    if (!missingGps.ok) expect(missingGps.error.code).toBe('gps_required');

    const out = await performClockOut({
      attendanceId: open.row.attendance_id,
      latitude: -6.2607,
      longitude: 106.8105,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId: 'EMP-006' },
      source: 'telegram'
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.row.actual_check_out).toMatch(/^\d{2}:\d{2}$/);
      expect(out.row.check_out_location).toBe('INSIDE_RADIUS');
      expect(Number(out.row.overtime_minutes)).toBeGreaterThanOrEqual(0);
    }
  });
});
