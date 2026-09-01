/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/hr/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (see /api/hr/summary precedent).
 * Note: hr audit schema uses `timestamp` (not `created_at`).
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

const MAX_LIMIT = 500;

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
  const entity = (q.get('entity') ?? '').toLowerCase();
  const entityId = q.get('entity_id') ?? q.get('entityId') ?? '';
  const period = q.get('period') ?? '';
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (entity) rows = rows.filter((r) => (r.entity ?? '').toLowerCase() === entity);
  if (entityId) rows = rows.filter((r) => r.entity_id === entityId);
  if (period) rows = rows.filter((r) => r.entity_id.includes(period) || (r.after_value ?? '').includes(period));
  if (from) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  return list(rows.slice(0, limit));
});
