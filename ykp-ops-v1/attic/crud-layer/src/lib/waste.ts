/**
 * Pure waste aggregation logic ΓÇö brief ┬º6.8.
 *
 * Rules:
 * - total waste value > daily threshold = HIGH alert
 * - same ingredient wasted >= 3 times in 7 days = REVIEW alert
 */
export interface WasteRowLike {
  date?: string;
  qty?: string;
  estimated_total_value?: string;
  ingredient_name?: string;
  outlet_id?: string;
}

export interface WasteAggregate {
  count: number;
  totalQty: number;
  totalValue: number;
}

/** Aggregate waste rows for one outlet on one date. */
export function aggregateWaste(rows: WasteRowLike[], date: string, outletId?: string): WasteAggregate {
  const filtered = rows.filter((r) => r.date === date && (!outletId || r.outlet_id === outletId));
  return {
    count: filtered.length,
    totalQty: filtered.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    totalValue: filtered.reduce((s, r) => s + (Number(r.estimated_total_value) || 0), 0)
  };
}

/** Add (or subtract) days to a YYYY-MM-DD date string. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ingredients wasted >= minCount times within the trailing `days` window
 * ending at refDate (inclusive), for one outlet.
 */
export function repeatedWasteIngredients(
  rows: WasteRowLike[],
  refDate: string,
  outletId?: string,
  days = 7,
  minCount = 3
): string[] {
  const from = shiftDate(refDate, -(days - 1));
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (outletId && r.outlet_id !== outletId) continue;
    const d = r.date ?? '';
    if (d < from || d > refDate) continue;
    const name = r.ingredient_name ?? '';
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= minCount).map(([name]) => name);
}
