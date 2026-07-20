/**
 * Audit trail read endpoint.
 * GET /api/investor/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Session required, owner only.
 * Note: investor audit schema uses `timestamp` (not `created_at`).
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler, unauthorized, forbidden } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isOwner } from '@/lib/rbac';

const MAX_LIMIT = 500;

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isOwner(s.role)) return forbidden();

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
