/**
 * PUBLIC health endpoint for the YKP hub launcher / owner dashboard.
 * GET /api/warehouse/summary/count → row counts + latest summary date.
 * Public GET via middleware allowlist (PUBLIC_GET_PREFIXES covers
 * /api/warehouse/summary*); same shape as the finance sibling.
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.dailySummary);
  const dates = rows.map((r) => r.date).sort();
  return ok({
    count: rows.length,
    latest_date: dates.at(-1) ?? null,
    earliest_date: dates[0] ?? null
  });
});
