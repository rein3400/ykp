import { describe, expect, it } from 'vitest';
import { canAttendAnyOutlet, resolveAttendanceOutlet } from './multi-location';

const outlets = [
  { outlet_id: 'OL-1', outlet_name: 'Home', status: 'active' },
  { outlet_id: 'OL-2', outlet_name: 'Other', status: 'active' },
  { outlet_id: 'OL-3', outlet_name: 'Closed', status: 'inactive' }
];

describe('multi-location attendance', () => {
  it('lets roaming roles attend any active outlet', () => {
    expect(canAttendAnyOutlet('supervisor')).toBe(true);
    expect(resolveAttendanceOutlet({ role: 'supervisor', homeOutletId: 'OL-1', requestedOutletId: 'OL-2', outlets })).toEqual(outlets[1]);
  });
  it('keeps ordinary staff on their home outlet and rejects another outlet', () => {
    expect(canAttendAnyOutlet('employee')).toBe(false);
    expect(resolveAttendanceOutlet({ role: 'employee', homeOutletId: 'OL-1', outlets })).toEqual(outlets[0]);
    expect(() => resolveAttendanceOutlet({ role: 'employee', homeOutletId: 'OL-1', requestedOutletId: 'OL-2', outlets })).toThrow();
  });
  it('rejects inactive or unknown outlets and missing home outlet', () => {
    expect(() => resolveAttendanceOutlet({ role: 'supervisor', homeOutletId: 'OL-1', requestedOutletId: 'OL-3', outlets })).toThrow();
    expect(() => resolveAttendanceOutlet({ role: 'supervisor', homeOutletId: '', requestedOutletId: 'OL-9', outlets })).toThrow();
    expect(() => resolveAttendanceOutlet({ role: 'employee', homeOutletId: '', outlets })).toThrow();
  });
});
