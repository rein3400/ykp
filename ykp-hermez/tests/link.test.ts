import { describe, it, expect } from 'vitest';
import {
  isLinkCommand, isMeCommand, isClockInCommand, isClockOutCommand,
  isAttendanceCommand, isScheduleCommand, isLeaveCommand, isStartCommand,
  isHelpCommand, attendanceKeyboard, mainMenuKeyboard, employeeHelpText,
  isStartLinkCommand, startLinkCode,
} from '../src/link.js';

describe('link command matchers', () => {
  it('isLinkCommand matches /link <6-char code>', () => {
    // Code charset is [A-Z2-9] (no 0/1/O/I to avoid ambiguity).
    expect(isLinkCommand('/link ABC234')).toBe(true);
    expect(isLinkCommand('/link abc234')).toBe(true);
    expect(isLinkCommand('/link A2B3C4')).toBe(true);
    expect(isLinkCommand('/link ABC23')).toBe(false); // 5 chars
    expect(isLinkCommand('/link ABC2345')).toBe(false); // 7 chars
    expect(isLinkCommand('/link ABC123')).toBe(false); // contains 1 (invalid)
    expect(isLinkCommand('/link')).toBe(false);
    expect(isLinkCommand('link ABC234')).toBe(false);
  });

  it('isMeCommand matches /me', () => {
    expect(isMeCommand('/me')).toBe(true);
    expect(isMeCommand('/me ')).toBe(true);
    expect(isMeCommand('/me x')).toBe(false);
  });

  it('isClockInCommand / isClockOutCommand', () => {
    expect(isClockInCommand('/clock-in')).toBe(true);
    expect(isClockInCommand('/clock-out')).toBe(false);
    expect(isClockOutCommand('/clock-out')).toBe(true);
  });

  it('isAttendanceCommand matches /absen', () => {
    expect(isAttendanceCommand('/absen')).toBe(true);
    expect(isAttendanceCommand('/absen 07:00')).toBe(false);
  });

  it('isScheduleCommand matches /jadwal', () => {
    expect(isScheduleCommand('/jadwal')).toBe(true);
  });

  it('isLeaveCommand matches /cuti', () => {
    expect(isLeaveCommand('/cuti')).toBe(true);
  });

  it('isStartCommand / isHelpCommand', () => {
    expect(isStartCommand('/start')).toBe(true);
    expect(isHelpCommand('/help')).toBe(true);
  });

  it('isStartLinkCommand matches /start <6-char code> (deep-link)', () => {
    expect(isStartLinkCommand('/start ABC234')).toBe(true);
    expect(isStartLinkCommand('/start abc234')).toBe(true);
    expect(isStartLinkCommand('/start ABC23')).toBe(false); // 5 chars
    expect(isStartLinkCommand('/start')).toBe(false); // plain /start
    expect(isStartLinkCommand('/start ABC2345')).toBe(false); // 7 chars
  });

  it('startLinkCode extracts the 6-char code', () => {
    expect(startLinkCode('/start ABC234')).toBe('ABC234');
    expect(startLinkCode('/start abc234')).toBe('ABC234'); // uppercased
    expect(startLinkCode('/start')).toBeNull();
    expect(startLinkCode('/start ABC23')).toBeNull();
  });
});

describe('keyboards', () => {
  it('attendanceKeyboard has clock-in/out/location/menu buttons', () => {
    const kb = attendanceKeyboard();
    const flat = kb.flat().map((b) => b.callback_data);
    expect(flat).toContain('att:clock-in');
    expect(flat).toContain('att:clock-out');
    expect(flat).toContain('att:location');
    expect(flat).toContain('main:menu');
  });

  it('mainMenuKeyboard has absen/jadwal/cuti/me/help', () => {
    const kb = mainMenuKeyboard();
    const flat = kb.flat().map((b) => b.callback_data);
    expect(flat).toContain('main:absen');
    expect(flat).toContain('main:jadwal');
    expect(flat).toContain('main:cuti');
    expect(flat).toContain('main:me');
    expect(flat).toContain('main:help');
  });
});

describe('employeeHelpText', () => {
  it('mentions /link and the main commands', () => {
    const t = employeeHelpText();
    expect(t).toContain('/link');
    expect(t).toContain('/absen');
    expect(t).toContain('/jadwal');
    expect(t).toContain('/cuti');
    expect(t).toContain('/me');
  });
});
