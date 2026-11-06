import { classifyLocation, type GeoPoint } from './attendance-geo';
import { canAttendAnyOutlet, isActiveOutlet, type OutletRef } from './multi-location';

export interface OutletGeoRow extends OutletRef {
  brand_id?: string;
  latitude?: string;
  longitude?: string;
  attendance_radius_m?: string;
}

/**
 * Choose the outlet an attendance event belongs to.
 * Roaming roles (SPV/manager/finance/HR/owner) may attend from any active outlet;
 * the bot has no outlet picker, so pick the NEAREST active outlet whose own
 * radius contains the GPS point. Non-roaming staff always use their home outlet.
 */
export function resolveNearestOutlet(input: {
  role: string | undefined;
  homeOutletId: string | undefined;
  reported: GeoPoint;
  outlets: OutletGeoRow[];
}): { outlet: OutletGeoRow; distanceMeters: number; radiusMeters: number } {
  const active = input.outlets.filter((outlet) => isActiveOutlet(outlet));

  if (!canAttendAnyOutlet(input.role)) {
    const home = active.find((outlet) => outlet.outlet_id === (input.homeOutletId ?? '').trim());
    if (!home) throw new Error('Outlet penempatan kamu tidak aktif. Hubungi HR.');
    const verdict = classifyLocation(input.reported, {
      latitude: Number(home.latitude),
      longitude: Number(home.longitude),
      attendanceRadiusM: Number(home.attendance_radius_m)
    });
    if (verdict.classification === 'NO_OUTLET_GEO') throw new Error('Koordinat/radius outlet belum valid; hubungi HR.');
    if (verdict.outsideRadius) throw new Error(`Clock-in di luar radius outlet (${verdict.distanceMeters}m > ${verdict.radiusMeters}m).`);
    return { outlet: home, distanceMeters: verdict.distanceMeters, radiusMeters: verdict.radiusMeters };
  }

  const candidates = active
    .map((outlet) => {
      const verdict = classifyLocation(input.reported, {
        latitude: Number(outlet.latitude),
        longitude: Number(outlet.longitude),
        attendanceRadiusM: Number(outlet.attendance_radius_m)
      });
      return { outlet, verdict };
    })
    .filter((candidate) => candidate.verdict.classification === 'INSIDE_RADIUS')
    .sort((a, b) => a.verdict.distanceMeters - b.verdict.distanceMeters);

  if (candidates.length === 0) {
    const nearest = active
      .map((outlet) => ({ outlet, verdict: classifyLocation(input.reported, {
        latitude: Number(outlet.latitude), longitude: Number(outlet.longitude), attendanceRadiusM: Number(outlet.attendance_radius_m)
      }) }))
      .filter((candidate) => candidate.verdict.classification !== 'NO_OUTLET_GEO')
      .sort((a, b) => a.verdict.distanceMeters - b.verdict.distanceMeters)[0];
    if (!nearest) throw new Error('Koordinat/radius outlet belum valid; hubungi HR.');
    throw new Error(`Clock-in di luar radius semua outlet (terdekat ${nearest.outlet.outlet_name}: ${nearest.verdict.distanceMeters}m > ${nearest.verdict.radiusMeters}m).`);
  }

  return {
    outlet: candidates[0].outlet,
    distanceMeters: candidates[0].verdict.distanceMeters,
    radiusMeters: candidates[0].verdict.radiusMeters
  };
}
