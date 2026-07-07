/**
 * Hermez-facing endpoint: GET /api/hr/summary?date=YYYY-MM-DD
 * Returns the daily summary rows. Hermez reads these (read-only).
 */
import { readTab, TABS } from '@/db/sheets';
import { handler, list, badRequest } from '@/lib/http';

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const all = await readTab<Record<string, string>>(TABS.dailySummary);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD');
  const filtered = date ? all.filter((r) => r.date === date) : all;
  return list(filtered);
});
