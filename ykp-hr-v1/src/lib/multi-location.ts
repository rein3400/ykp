/**
 * Multi-location attendance policy (client: SPV/manager/finance may attend from
 * any outlet, others are tied to their home outlet). GPS is always still
 * enforced against the chosen outlet's radius — roaming never bypasses geofence.
 */
export const ROAMING_ROLES = new Set([
  'supervisor', 'outlet_manager', 'brand_manager', 'manager', 'finance_admin', 'hr_admin', 'owner', 'super_admin'
]);

export interface OutletRef {
  outlet_id: string;
  outlet_name?: string;
  status?: string;
}

export function canAttendAnyOutlet(role: string | undefined): boolean {
  return ROAMING_ROLES.has((role ?? '').trim().toLowerCase());
}

export function isActiveOutlet(outlet: OutletRef): boolean {
  return ['active', '1'].includes((outlet.status ?? '').trim().toLowerCase());
}

/**
 * Decide which outlet an attendance event belongs to.
 * - Non-roaming staff MUST use their home outlet; a different request is rejected.
 * - Roaming roles may pick any ACTIVE outlet; default is the home outlet.
 * Throws a user-facing error on any invalid/forbidden/inactive choice.
 */
export function resolveAttendanceOutlet(input: {
  role: string | undefined;
  homeOutletId: string | undefined;
  requestedOutletId?: string;
  outlets: OutletRef[];
}): OutletRef {
  const requested = (input.requestedOutletId ?? '').trim();
  const targetId = requested || (input.homeOutletId ?? '').trim();
  if (!targetId) throw new Error('Outlet kamu belum diset. Hubungi HR.');
  const outlet = input.outlets.find((o) => o.outlet_id === targetId);
  if (!outlet) throw new Error('Outlet tidak ditemukan.');
  if (!isActiveOutlet(outlet)) throw new Error('Outlet tidak aktif.');
  if (!canAttendAnyOutlet(input.role) && targetId !== (input.homeOutletId ?? '').trim()) {
    throw new Error('Kamu hanya bisa absen di outlet kamu. Hubungi SPV bila perlu absen di lokasi lain.');
  }
  return outlet;
}
