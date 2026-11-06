import { describe, expect, it } from 'vitest';
import { resolveNearestOutlet } from './nearest-outlet';

const outlets = [
  { outlet_id: 'TIRTO', outlet_name: 'Sekar Pizza Tirtodipuran', brand_id: 'BR2', status: 'active', latitude: '-7.815878443845983', longitude: '110.36594534974564', attendance_radius_m: '100' },
  { outlet_id: 'COLOMBO', outlet_name: 'Sekar Pizza Colombo', brand_id: 'BR2', status: 'active', latitude: '-7.778413113354156', longitude: '110.39028107033222', attendance_radius_m: '100' }
];

describe('nearest outlet for roaming staff', () => {
  it('picks the outlet whose radius contains the GPS point instead of the home outlet', () => {
    const point = { latitude: -7.7784131, longitude: 110.3902811 };
    const picked = resolveNearestOutlet({ role: 'supervisor', homeOutletId: 'TIRTO', reported: point, outlets });
    expect(picked.outlet.outlet_id).toBe('COLOMBO');
    expect(picked.distanceMeters).toBeLessThan(5);
  });

  it('keeps non-roaming employees at their home outlet and rejects another outlet', () => {
    const atHome = resolveNearestOutlet({
      role: 'employee', homeOutletId: 'TIRTO',
      reported: { latitude: -7.81587844, longitude: 110.36594535 }, outlets
    });
    expect(atHome.outlet.outlet_id).toBe('TIRTO');
    expect(() => resolveNearestOutlet({
      role: 'employee', homeOutletId: 'TIRTO',
      reported: { latitude: -7.7784131, longitude: 110.3902811 }, outlets
    })).toThrow(/radius/i);
  });

  it('reports the nearest distance when no outlet geofence contains the point', () => {
    const point = { latitude: -7.9, longitude: 110.5 };
    expect(() => resolveNearestOutlet({ role: 'supervisor', homeOutletId: 'TIRTO', reported: point, outlets })).toThrow(/radius/i);
  });

  it('ignores outlets without coordinates or radius', () => {
    const point = { latitude: -7.7784131, longitude: 110.3902811 };
    expect(() => resolveNearestOutlet({
      role: 'supervisor',
      homeOutletId: 'TIRTO',
      reported: point,
      outlets: [
        { outlet_id: 'NOGEO', brand_id: 'BR1', status: 'active' },
        { outlet_id: 'FAR', brand_id: 'BR1', status: 'active', latitude: '1', longitude: '1', attendance_radius_m: '100' }
      ]
    })).toThrow(/radius/i);
  });
});
