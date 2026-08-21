/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/investor/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (see /api/investor/summary precedent).
 * Note: investor audit schema uses `timestamp` (not `created_at`).
 *
 * Security: beforeValue/afterValue may contain capital amounts, dividend
 * payouts, or investor PII. This endpoint is public (Hermez reads it), so
 * we strip those payload fields and keep only activity metadata.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

const MAX_LIMIT = 500;
const REDACTED_FIELDS = ['beforeValue', 'afterValue'] as const;

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (from) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  const safe = rows.slice(0, limit).map((r) => {
    const copy: Record<string, string> = { ...r };
    for (const f of REDACTED_FIELDS) delete copy[f];
    return copy;
  });
  return list(safe);
});
