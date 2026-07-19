/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/investor/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (see /api/investor/summary precedent).
 * Note: investor audit schema uses `timestamp` (not `created_at`).
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

const MAX_LIMIT = 500;

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (from) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  return list(rows.slice(0, limit));
});
