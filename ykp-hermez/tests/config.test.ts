import { describe, it, expect } from 'vitest';
import { idr, daysAgoWib, todayWib, wibHourMinute } from '../src/config.js';

describe('config helpers', () => {
  it('idr formats with thousands separators', () => {
    expect(idr(0)).toBe('Rp0');
    expect(idr(1234567)).toBe('Rp1.234.567');
    expect(idr(-50000)).toBe('-Rp50.000');
    expect(idr(1000.7)).toBe('Rp1.001');
  });

  it('todayWib returns YYYY-MM-DD', () => {
    expect(todayWib()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('daysAgoWib returns a valid date n days back', () => {
    const d = daysAgoWib(1);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 7 days ago must be strictly before today
    expect(daysAgoWib(7) < todayWib()).toBe(true);
  });

  it('wibHourMinute returns hour 0-23 and minute 0-59', () => {
    const { hour, minute } = wibHourMinute();
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThanOrEqual(59);
  });
});
