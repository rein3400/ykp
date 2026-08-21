/**
 * Public Hermez-facing summary read endpoint.
 * GET /api/ops/summary?date=YYYY-MM-DD
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';
import { todayWib } from '@/lib/format';

export const GET = handler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayWib();
  const brandId = url.searchParams.get('brand_id');
  const outletId = url.searchParams.get('outlet_id');
  const rows = await readTab(TABS.summary);
  let filtered = rows.filter((r) => r.date === date);
  if (brandId) filtered = filtered.filter((r) => r.brand_id === brandId);
  if (outletId) filtered = filtered.filter((r) => r.outlet_id === outletId);
  // Return only rows for the requested date. The previous fallback
  // (rows.slice(-10) when no rows matched) leaked cross-date operational data
  // (revenue, cash_difference, incident counts, waste_value) to unauthenticated
  // Hermez callers.
  return ok({
    date,
    items: filtered,
    total: filtered.length,
  });
});
