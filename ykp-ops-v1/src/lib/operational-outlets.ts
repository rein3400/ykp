export function operationalOutletScope<T extends Record<string, string>>(
  rows: T[], scope: { brandId?: string; outletId?: string }
): T[] {
  return rows.filter((row) => ['active', '1'].includes((row.status ?? '').trim().toLowerCase()) &&
    (!scope.brandId || row.brand_id === scope.brandId) &&
    (!scope.outletId || row.outlet_id === scope.outletId));
}
