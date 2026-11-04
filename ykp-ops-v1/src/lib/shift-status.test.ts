import { describe, expect, it } from 'vitest';
import { activeShift } from './shift-status';
describe('shared HR/Ops shift lifecycle', () => {
 it('uses canonical HR lifecycle before legacy status', () => {
  expect(activeShift({ active_status: 'active' })).toBe(true);
  expect(activeShift({ active_status: 'inactive', status: 'active' })).toBe(false);
  expect(activeShift({ active_status: ' ACTIVE ', status: '08:00' })).toBe(true);
 });
 it('supports legacy values but fails closed on missing or corrupt status', () => {
  expect(activeShift({ status: ' 1 ' })).toBe(true);
  expect(activeShift({ status: ' ACTIVE ' })).toBe(true);
  expect(activeShift({ status: '8:00' })).toBe(false);
  expect(activeShift({})).toBe(false);
 });
});
