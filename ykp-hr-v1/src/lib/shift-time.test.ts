import { describe, expect, it } from 'vitest';
import { normalizeShiftTime } from './shift-time';
describe('stored shift time compatibility',()=>{
 it('normalizes legacy single digit hours for forms and comparisons',()=>{
  expect(normalizeShiftTime('8:00')).toBe('08:00');
  expect(normalizeShiftTime(' 07:30 ')).toBe('07:30');
  expect(normalizeShiftTime('16:00')).toBe('16:00');
  expect(()=>normalizeShiftTime('25:00')).toThrow();
 });
});
