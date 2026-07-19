/**
 * PUBLIC health endpoint for the YKP hub launcher / owner dashboard.
 * GET /api/investor/summary/count → row counts + latest summary date.
 * Same response shape as the finance/warehouse/ops siblings.
 * (Allowlisted publicly by middleware: GET /api/investor/summary*.)
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.summary);
  const dates = rows.map((r) => r.date).sort();
  return ok({
    count: rows.length,
    latest_date: dates.at(-1) ?? null,
    earliest_date: dates[0] ?? null
  });
});
