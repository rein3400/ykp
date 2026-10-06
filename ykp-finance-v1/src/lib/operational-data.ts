export function activeOutlets<T extends { status?: string }>(outlets: T[]): T[] {
  return outlets.filter((outlet) => ['active', '1'].includes((outlet.status ?? '').trim().toLowerCase()));
}

export function operationalRows<T extends { outlet_id?: string }>(
  rows: T[], outlets: { outlet_id?: string; status?: string }[]
): T[] {
  const ids = new Set(activeOutlets(outlets).map((outlet) => outlet.outlet_id));
  return rows.filter((row) => !row.outlet_id || ids.has(row.outlet_id));
}
