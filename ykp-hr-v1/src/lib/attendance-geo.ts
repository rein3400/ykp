/**
 * Attendance location classification (shared by web clock-in + Telegram absen).
 *
 * Pure — no I/O. The web `/clock-in` route and the Telegram webhook both call
 * `classifyLocation` so the radius rule is enforced identically on every path.
 *
 * Radius is configurable per outlet (`master_outlet.attendance_radius_m`),
 * default 100 m (brief §6.3). GPS error tolerance is handled by the outlet's
 * radius value, not by a hidden buffer.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface OutletGeo {
  latitude: number;
  longitude: number;
  /** Radius in meters. 0 or missing means "no radius configured". */
  attendanceRadiusM: number;
}

export type LocationClass =
  | 'INSIDE_RADIUS'
  | 'OUTSIDE_RADIUS'
  | 'NO_OUTLET_GEO'
  | 'NO_COORDS';

export interface LocationVerdict {
  classification: LocationClass;
  distanceMeters: number;
  radiusMeters: number;
  /** true when a radius is configured and the point is outside it. */
  outsideRadius: boolean;
}

/** Haversine distance in meters between two lat/lon points. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Classify an employee's reported location against their outlet's geofence.
 *
 * - No coords → `NO_COORDS` (allowed to continue; fallback is a correction
 *   request per brief §6.3, never a hard block).
 * - Outlet has no usable lat/lon or radius → `NO_OUTLET_GEO` (allowed).
 * - Inside/outside → verdict with distance so the caller can produce a
 *   precise, human-readable error.
 */
export function classifyLocation(
  reported: GeoPoint | null,
  outlet: OutletGeo | null
): LocationVerdict {
  if (!reported || !Number.isFinite(reported.latitude) || !Number.isFinite(reported.longitude)) {
    return { classification: 'NO_COORDS', distanceMeters: 0, radiusMeters: 0, outsideRadius: false };
  }
  const oLat = outlet ? Number(outlet.latitude) : NaN;
  const oLon = outlet ? Number(outlet.longitude) : NaN;
  const radius = outlet ? Number(outlet.attendanceRadiusM) : 0;
  if (!Number.isFinite(oLat) || !Number.isFinite(oLon) || !Number.isFinite(radius) || radius <= 0) {
    return { classification: 'NO_OUTLET_GEO', distanceMeters: 0, radiusMeters: 0, outsideRadius: false };
  }
  const dist = Math.round(distanceMeters(reported, { latitude: oLat, longitude: oLon }));
  const outside = dist > radius;
  return {
    classification: outside ? 'OUTSIDE_RADIUS' : 'INSIDE_RADIUS',
    distanceMeters: dist,
    radiusMeters: Math.round(radius),
    outsideRadius: outside
  };
}

/** Parse arbitrary numeric strings (Sheets / Telegram) into a GeoPoint or null. */
export function parseGeoPoint(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined
): GeoPoint | null {
  const latRaw = String(latitude ?? '').trim();
  const lonRaw = String(longitude ?? '').trim();
  if (!latRaw || !lonRaw) return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}
