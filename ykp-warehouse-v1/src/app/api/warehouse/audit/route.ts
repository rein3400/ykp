/**
 * PUBLIC (owner layer): audit trail read endpoint.
 * GET /api/warehouse/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth is bypassed for GET in middleware.ts (PUBLIC_GET_PREFIXES).
 *
 * POST /api/warehouse/audit { action: 'verify_chain' }
 * Authenticated — runs the tamper-evidence hash-chain verification.
 * Not public: chain status reveals whether tampering was detected.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler, ok, unauthorized, badRequest } from '@/lib/http';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { verifyAuditChain } from '@/lib/audit';

const MAX_LIMIT = 500;

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (from) rows = rows.filter((r) => (r.created_at ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.created_at ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows.slice(0, limit));
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'audit')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'verify_chain') return badRequest("action must be 'verify_chain'");

  const result = await verifyAuditChain();
  return ok(result);
});
