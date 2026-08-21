/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/finance/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (PUBLIC_GET_PREFIXES).
 *
 * Security: beforeValue/afterValue may contain amounts, supplier details,
 * or payment references. This endpoint is public (Hermez reads it), so we
 * strip those payload fields and keep only activity metadata.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

const MAX_LIMIT = 500;
// Sheet columns are snake_case (TAB_HEADERS.auditLog: before_value/after_value).
// The previous camelCase names never matched, so the delete was a no-op and PII leaked.
const REDACTED_FIELDS = ['before_value', 'after_value'] as const;

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (from) rows = rows.filter((r) => (r.created_at ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.created_at ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const safe = rows.slice(0, limit).map((r) => {
    const copy: Record<string, string> = { ...r };
    for (const f of REDACTED_FIELDS) delete copy[f];
    return copy;
  });
  return list(safe);
});
