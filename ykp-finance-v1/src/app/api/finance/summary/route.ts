/**
 * PUBLIC endpoint for the Hermez / owner hub layer.
 * GET /api/finance/summary?date=YYYY-MM-DD&outlet_id=OL-001
 * Returns fin_daily_summary rows (default: today WIB; falls back to latest).
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';
import { todayWib } from '@/lib/format';

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const date = q.get('date') ?? todayWib();
  const outletId = q.get('outlet_id') ?? '';
  const brandId = q.get('brand_id') ?? '';

  const rows = await readTab<Record<string, string>>(TABS.dailySummary);
  let filtered = rows.filter((r) =>
    r.date === date
    && (!outletId || r.outlet_id === outletId)
    && (!brandId || r.brand_id === brandId)
  );
  // Fallback: when nothing for the requested date, return the latest available date
  if (filtered.length === 0 && !q.get('date')) {
    const latest = rows.map((r) => r.date).sort().at(-1);
    if (latest) {
      filtered = rows.filter((r) =>
        r.date === latest
        && (!outletId || r.outlet_id === outletId)
        && (!brandId || r.brand_id === brandId)
      );
    }
  }
  return ok({ date, items: filtered, total_items: filtered.length });
});
