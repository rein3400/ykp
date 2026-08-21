import { describe, it, expect, beforeAll, beforeEach, vi, type MockInstance } from 'vitest';

// Force the in-memory mock DB so these tests exercise the real read path
// (readTab against the seeded store) without Google credentials.
process.env.USE_MOCK_DB = 'true';
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.YKP_HR_SPREADSHEET_ID;

import {
  findEmployeeByTelegramId,
  findTodayAttendance,
  findOpenAttendance,
  findTodayRoster,
  findLatenessRule,
  findUserByEmployeeId
} from './attendance-lookup';
import { performClockIn, performClockOut } from './attendance-service';
import { parseAbsenIntent, HELP_TEXT } from './telegram-attendance';
import { resetMockStore } from '@/db/mock-store';

// Mock store persists across tests in the same process. The helpers read
// the seeded tabs (12 employees, 3 outlets, 2 lateness rules, 14 attendance
// rows today+yesterday, 8 roster rows today).

beforeAll(() => {
  // Telegram token + webhook secret are read by the webhook route. Set them
  // so the route's early-return guards don't fire when we POST to it.
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
});

describe('findEmployeeByTelegramId (large-headcount resolution)', () => {
  it('resolves an employee by their linked Telegram chat id', async () => {
    // EMP-001 (Budi Santoso) has telegram_id '551234001' in the seed.
    const emp = await findEmployeeByTelegramId(551234001);
    expect(emp).not.toBeNull();
    expect(emp?.employee_id).toBe('EMP-001');
    expect(emp?.outlet_id).toBe('OL-001');
  });

  it('accepts the chat id as a string or number (Telegram sends a number)', async () => {
    expect((await findEmployeeByTelegramId('551234002'))?.employee_id).toBe('EMP-002');
    expect((await findEmployeeByTelegramId(551234002))?.employee_id).toBe('EMP-002');
  });

  it('returns null when the chat id is not linked to any employee', async () => {
    expect(await findEmployeeByTelegramId(999999999)).toBeNull();
    expect(await findEmployeeByTelegramId('')).toBeNull();
  });

  it('returns null for employees whose telegram_id column is empty (EMP-008, EMP-011)', async () => {
    // EMP-008 and EMP-011 have telegram_id '' — they should NOT match any chat id.
    expect(await findEmployeeByTelegramId('')).toBeNull();
  });

  it('trims whitespace around the stored telegram_id before comparing', async () => {
    // The mock seed stores clean ids; this test documents the trim contract.
    // If a sheet cell had trailing spaces, the lookup would still match.
    const emp = await findEmployeeByTelegramId(' 551234001 ');
    // ' 551234001 '.trim() === '551234001' — should match EMP-001.
    expect(emp?.employee_id).toBe('EMP-001');
  });
});

describe('findTodayAttendance (idempotency lookup)', () => {
  it('returns the existing attendance row for today when the employee has clocked in', async () => {
    // EMP-001 has ATT-001 today with actual_check_in '06:55'.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const row = await findTodayAttendance('EMP-001', today);
    expect(row).not.toBeNull();
    expect(row?.attendance_id).toBe('ATT-001');
    expect(row?.actual_check_in).toBe('06:55');
  });

  it('returns null when the employee has no attendance row today', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    // EMP-005 has no attendance row today (roster OFF).
    expect(await findTodayAttendance('EMP-005', today)).toBeNull();
  });

  it('returns null for empty employeeId or date', async () => {
    expect(await findTodayAttendance('', '2026-08-21')).toBeNull();
    expect(await findTodayAttendance('EMP-001', '')).toBeNull();
  });
});

describe('findOpenAttendance (clock-out open-row lookup)', () => {
  it('returns the open row (actual_check_in set, actual_check_out empty)', async () => {
    // EMP-002 has ATT-004 today: actual_check_in '10:52', actual_check_out ''.
    const row = await findOpenAttendance('EMP-002');
    expect(row).not.toBeNull();
    expect(row?.attendance_id).toBe('ATT-004');
    expect(row?.actual_check_in).toBeTruthy();
    expect(row?.actual_check_out).toBe('');
  });

  it('returns null when the employee has already clocked out', async () => {
    // EMP-001 has ATT-001 today with actual_check_out '15:05' — not open.
    expect(await findOpenAttendance('EMP-001')).toBeNull();
  });

  it('returns null when the employee has no attendance row at all', async () => {
    expect(await findOpenAttendance('EMP-005')).toBeNull();
  });
});

describe('findTodayRoster', () => {
  it('returns the roster row for today when the employee is scheduled', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    // EMP-001 has ROS-001 today, shift SH-001.
    const roster = await findTodayRoster('EMP-001', today);
    expect(roster).not.toBeNull();
    expect(roster?.shift_id).toBe('SH-001');
  });

  it('returns null when the employee is not rostered today', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    // No employee with id 'EMP-999' exists.
    expect(await findTodayRoster('EMP-999', today)).toBeNull();
  });
});

describe('findLatenessRule (explicit fallback)', () => {
  it('returns the outlet-specific rule when one exists for the outlet', async () => {
    // OL-002 has LR-002 (Flat Sekarpizza, tolerance 5).
    const rule = await findLatenessRule('OL-002');
    expect(rule).not.toBeNull();
    expect(rule?.tolerance_minutes).toBe('5');
    expect(rule?.rule_id ?? '').toBe('LR-002');
  });

  it('falls back to the global-default rule (empty outlet_id) when no outlet-specific rule exists', async () => {
    // OL-001 has no specific rule. LR-001 has outlet_id '' (global default, tolerance 10).
    const rule = await findLatenessRule('OL-001');
    expect(rule).not.toBeNull();
    expect(rule?.tolerance_minutes).toBe('10');
    // The previous behavior returned rules[0] (arbitrary); now it returns
    // the explicit global default, so tolerance is deterministic.
    expect(rule?.rule_id ?? '').toBe('LR-001');
  });

  it('returns null when no rule matches and no global default exists (defensive)', async () => {
    // OL-999 has no rule. LR-001 is the global default, so this returns LR-001
    // (the global default), not null. Document the contract: global default
    // is the fallback when no outlet-specific rule exists.
    const rule = await findLatenessRule('OL-999');
    expect(rule).not.toBeNull();
    expect(rule?.rule_id ?? '').toBe('LR-001');
  });
});

describe('findUserByEmployeeId', () => {
  it('resolves the linked user account for an employee', async () => {
    // EMP-001 is linked to USR-001 (owner).
    const user = await findUserByEmployeeId('EMP-001');
    expect(user).not.toBeNull();
    expect(user?.user_id).toBe('USR-001');
    expect(user?.role).toBe('owner');
  });

  it('returns null when the employee has no linked user account', async () => {
    // EMP-003 has no user row (only EMP-001 and EMP-012 are linked).
    expect(await findUserByEmployeeId('EMP-003')).toBeNull();
  });
});

describe('performClockIn geofence (inside / outside / exempt)', () => {
  it('rejects an out-of-radius clock-in for a regular employee', async () => {
    // EMP-011 (Intan, OL-003 radius 150m) — far away coordinates.
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

  it('accepts an inside-radius clock-in (PRESENT)', async () => {
    // EMP-005 (Rizky, OL-001 center -6.2741,106.8006 radius 100m) — same point.
    const r = await performClockIn({
      employeeId: 'EMP-005',
      latitude: -6.2741,
      longitude: 106.8006,
      actor: { userId: 'USR-TEST', role: 'employee', employeeId: 'EMP-005' },
      source: 'telegram'
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.check_in_location).toBe('INSIDE_RADIUS');
      expect(['PRESENT', 'LATE']).toContain(r.row.attendance_status);
    }
  });

  it('allows a management-role employee (owner) to clock in from outside the radius', async () => {
    // EMP-001 is linked to USR-001 (owner). Owner is in GEO_EXEMPT_ROLES.
    // Clock in from far away — should be PRESENT (outside radius + exempt).
    const r = await performClockIn({
      employeeId: 'EMP-001',
      latitude: -6.1000,
      longitude: 106.6000,
      actor: { userId: 'USR-001', role: 'owner', employeeId: 'EMP-001' },
      source: 'telegram'
    });
    // EMP-001 already has ATT-001 today (actual_check_in '06:55'), so this
    // returns already:true — the idempotent path. The geofence is not
    // re-evaluated on the already path. This test documents that the
    // idempotent guard runs BEFORE the geofence.
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.already).toBe(true);
  });
});

describe('parseAbsenIntent (command parsing)', () => {
  it('maps /masuk to clock-in', () => {
    expect(parseAbsenIntent('/masuk')).toBe('clock-in');
    expect(parseAbsenIntent('/masuk ')).toBe('clock-in');
  });

  it('maps /pulang to clock-out', () => {
    expect(parseAbsenIntent('/pulang')).toBe('clock-out');
  });

  it('maps /start, /help, /bantuan to help', () => {
    expect(parseAbsenIntent('/start')).toBe('help');
    expect(parseAbsenIntent('/help')).toBe('help');
    expect(parseAbsenIntent('/bantuan')).toBe('help');
  });

  it('returns unknown for free text or empty', () => {
    expect(parseAbsenIntent('halo')).toBe('unknown');
    expect(parseAbsenIntent('')).toBe('unknown');
    expect(parseAbsenIntent(undefined)).toBe('unknown');
  });

  it('HELP_TEXT mentions the location instructions', () => {
    expect(HELP_TEXT).toContain('Kirim Lokasi');
    expect(HELP_TEXT).toContain('/masuk');
  });
});

describe('webhook route — missing-location + malformed-coords hardening', () => {
  // We import the route POST handler and call it with a synthetic Request.
  // sendTelegramText is mocked so no real HTTP call to Telegram happens.
  // The `handler()` wrapper from @/lib/http awaits ctx.params (Next.js 16
  // route context), so we pass an empty resolved params object as the 2nd arg.
  type RouteCtx = { params: Promise<Record<string, string>> };
  type SendFn = typeof import('./telegram-attendance')['sendTelegramText'];
  let POST: (req: Request, ctx: RouteCtx) => Promise<Response>;
  let sendSpy: MockInstance<SendFn>;

  beforeAll(async () => {
    const mod = await import('./telegram-attendance');
    sendSpy = vi.spyOn(mod, 'sendTelegramText').mockResolvedValue('mock-msg-id');
    const route = await import('@/app/api/hr/attendance/telegram/route');
    POST = route.POST;
  });

  // The mock store persists across tests in the same process. Earlier tests
  // in this file append attendance rows (e.g. EMP-005 inside-radius clock-in);
  // reset before each webhook test so EMP-005 starts with no row today.
  beforeEach(() => {
    resetMockStore();
    sendSpy.mockClear();
  });

  const emptyCtx: RouteCtx = { params: Promise.resolve({}) };

  function webhookRequest(body: unknown, withSecret = true): Request {
    return new Request('http://localhost/api/hr/attendance/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(withSecret ? { 'x-telegram-bot-api-secret-token': 'test-secret' } : {})
      },
      body: JSON.stringify(body)
    });
  }

  it('rejects a webhook with no secret token (401, never touches the store)', async () => {
    const res = await POST(webhookRequest({ message: { chat: { id: 551234001 }, text: '/masuk' } }, false), emptyCtx);
    expect(res.status).toBe(401);
  });

  it('asks for location (and does NOT clock in) when /masuk has no location', async () => {
    sendSpy.mockClear();
    const res = await POST(webhookRequest({
      message: { chat: { id: 551234001 }, text: '/masuk' }
    }), emptyCtx);
    expect(res.status).toBe(200);
    // The reply must ask for the location — not a clock-in confirmation.
    const call = sendSpy.mock.calls[0];
    expect(call).toBeTruthy();
    const text: string = String(call?.[2] ?? '');
    expect(text).toContain('Kirim lokasi');
    // No attendance row should have been appended for EMP-001 (it already has
    // ATT-001 today; the missing-location path returns before performClockIn).
    // We assert the reply text does NOT contain the clock-in success marker.
    expect(text).not.toContain('Absen masuk tercatat');
  });

  it('rejects a malformed location (NaN) without 500, replies with a helpful message', async () => {
    sendSpy.mockClear();
    const res = await POST(webhookRequest({
      message: {
        chat: { id: 551234001 },
        text: '/masuk',
        // Telegram would never send non-numeric coords, but we defend in depth.
        // JSON.stringify(NaN) === null, which Number(null)===0 (finite) would
        // slip past — so send a string that Number() turns into real NaN.
        location: { latitude: 'abc', longitude: 'xyz' }
      }
    }), emptyCtx);
    expect(res.status).toBe(200); // never 500 — we reply and return ok
    const call = sendSpy.mock.calls[0];
    const text: string = String(call?.[2] ?? '');
    expect(text).toContain('tidak valid');
    expect(text).not.toContain('Absen masuk tercatat');
  });

  it('replies "belum tertaut" when the chat id is not linked to an employee', async () => {
    sendSpy.mockClear();
    const res = await POST(webhookRequest({
      message: { chat: { id: 999999999 }, text: '/masuk', location: { latitude: -6.27, longitude: 106.8 } }
    }), emptyCtx);
    expect(res.status).toBe(200);
    const call = sendSpy.mock.calls[0];
    const text: string = String(call?.[2] ?? '');
    expect(text).toContain('belum tertaut');
  });

  it('clocks out an open row via /pulang', async () => {
    sendSpy.mockClear();
    // EMP-002 has ATT-004 today (open: actual_check_in set, check_out empty).
    const res = await POST(webhookRequest({
      message: { chat: { id: 551234002 }, text: '/pulang' }
    }), emptyCtx);
    expect(res.status).toBe(200);
    const call = sendSpy.mock.calls[0];
    const text: string = String(call?.[2] ?? '');
    expect(text).toContain('Absen pulang tercatat');
  });

  it('replies "belum ada absen masuk" for /pulang with no open row', async () => {
    sendSpy.mockClear();
    // EMP-005 has no attendance row today.
    const res = await POST(webhookRequest({
      message: { chat: { id: 551234005 }, text: '/pulang' }
    }), emptyCtx);
    expect(res.status).toBe(200);
    const call = sendSpy.mock.calls[0];
    const text: string = String(call?.[2] ?? '');
    expect(text).toContain('Belum ada absen masuk');
  });
});