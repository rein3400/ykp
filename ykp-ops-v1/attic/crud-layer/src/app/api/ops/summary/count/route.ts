/**
 * PUBLIC (hub health check): count of ops_daily_summary rows.
 * GET /api/ops/summary/count?date=YYYY-MM-DD
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';

export const GET = handler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  let rows = await readTab<Record<string, string>>(TABS.dailySummary);
  if (date) rows = rows.filter((r) => r.date === date);
  return ok({ count: rows.length, date: date ?? null });
});
