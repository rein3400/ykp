/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/hr/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (see /api/hr/summary precedent).
 * Note: hr audit schema uses `timestamp` (not `created_at`).
 *
 * Security: beforeValue/afterValue may contain salary, bank account, or
 * other PII. This endpoint is public (Hermez reads it), so we strip those
 * payload fields from the response and keep only the metadata Hermez needs
 * (actor, action, entity, timestamps, reason).
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

const MAX_LIMIT = 500;

/** Fields that may carry PII / sensitive amounts — never expose on public GET. */
const REDACTED_FIELDS = ['before_value', 'after_value'] as const;

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams;
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
