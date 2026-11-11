import { describe, expect, it } from 'vitest';
import { telegramAttendanceMarker, hasTelegramAttendanceUpdate } from './telegram-attendance-replay';
describe('durable GPS replay marker', () => {
 it('matches only the same employee/chat/update after a write and restart', () => {
  const marker = telegramAttendanceMarker(123456, 999);
  const stored = [{ employee_id: 'E1', notes: `clock-in via telegram | ${marker}` }];
  expect(hasTelegramAttendanceUpdate(stored, 'E1', 123456, 999)).toBe(true);
  expect(hasTelegramAttendanceUpdate(stored, 'E2', 123456, 999)).toBe(false);
  expect(hasTelegramAttendanceUpdate(stored, 'E1', 123456, 1000)).toBe(false);
  expect(hasTelegramAttendanceUpdate(stored, 'E1', 456789, 999)).toBe(false);
 });
 it('never matches legacy records without marker and rejects malformed identity', () => {
  expect(hasTelegramAttendanceUpdate([{employee_id:'E1',notes:'legacy'}], 'E1',123456,999)).toBe(false);
  expect(()=>telegramAttendanceMarker(123456,NaN)).toThrow();
 });
});
