/**
 * PUBLIC health endpoint for the YKP hub launcher.
 * GET /api/finance/summary/count → row counts + latest summary date.
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
