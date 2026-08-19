import { describe, it, expect } from 'vitest';
import { classifyLocation, distanceMeters, parseGeoPoint } from './attendance-geo';

describe('distanceMeters', () => {
  it('returns ~0 for identical points', () => {
    expect(distanceMeters({ latitude: -6.2741, longitude: 106.8006 }, { latitude: -6.2741, longitude: 106.8006 })).toBeLessThan(1);
  });

  it('roughly matches the outlet geofence in meters', () => {
    // Outlet at Cipete; ~100m north.
    const d = distanceMeters({ latitude: -6.2741, longitude: 106.8006 }, { latitude: -6.2732, longitude: 106.8006 });
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
});

describe('classifyLocation', () => {
  const outlet = { latitude: -6.2741, longitude: 106.8006, attendanceRadiusM: 100 };

  it('classifies inside radius', () => {
    const v = classifyLocation({ latitude: -6.2741, longitude: 106.8006 }, outlet);
    expect(v.classification).toBe('INSIDE_RADIUS');
    expect(v.outsideRadius).toBe(false);
    expect(v.distanceMeters).toBe(0);
    expect(v.radiusMeters).toBe(100);
  });

  it('classifies outside radius with distance', () => {
    const v = classifyLocation({ latitude: -6.2720, longitude: 106.8006 }, outlet);
    expect(v.classification).toBe('OUTSIDE_RADIUS');
    expect(v.outsideRadius).toBe(true);
    expect(v.distanceMeters).toBeGreaterThan(100);
  });

  it('returns NO_COORDS when reported point is missing', () => {
    expect(classifyLocation(null, outlet).classification).toBe('NO_COORDS');
  });

  it('returns NO_OUTLET_GEO when outlet has no radius/coords', () => {
    expect(classifyLocation({ latitude: -6.2741, longitude: 106.8006 }, null).classification).toBe('NO_OUTLET_GEO');
    expect(classifyLocation({ latitude: -6.2741, longitude: 106.8006 }, { latitude: 0, longitude: 0, attendanceRadiusM: 0 }).classification).toBe('NO_OUTLET_GEO');
  });
});

describe('parseGeoPoint', () => {
  it('parses numeric and numeric-string pairs', () => {
    expect(parseGeoPoint('-6.2741', '106.8006')).toEqual({ latitude: -6.2741, longitude: 106.8006 });
    expect(parseGeoPoint(-6.2741, 106.8006)).toEqual({ latitude: -6.2741, longitude: 106.8006 });
  });

  it('returns null for invalid inputs', () => {
    expect(parseGeoPoint('', '106.8006')).toBeNull();
    expect(parseGeoPoint('abc', '106.8006')).toBeNull();
    expect(parseGeoPoint(undefined, 106.8006)).toBeNull();
  });
});
