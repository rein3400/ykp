/**
 * Audit trail read + chain verification.
 * GET  /api/warehouse/audit?from=...&to=...&limit=...[&verify=1]
 *   — requires session cookie or valid x-bot-secret.
 *     verify=1 returns the tamper-evidence chain result instead of a listing.
 * POST /api/warehouse/audit { action: 'verify_chain' } — same engine, session+RBAC.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler, ok, unauthorized, badRequest, forbidden } from '@/lib/http';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { verifyAuditChain } from '@/lib/audit';

const MAX_LIMIT = 500;

function botAuthorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  return (req.headers.get('x-bot-secret') ?? '') === secret;
}

async function authOrBot(req: NextRequest): Promise<'ok' | 'unauth' | 'forbidden'> {
  if (botAuthorized(req)) return 'ok';
  const s = await getSession();
  if (!s) return 'unauth';
  if (!can(s.role as Role, 'view', 'audit')) return 'forbidden';
  return 'ok';
}

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const auth = await authOrBot(req);
  if (auth === 'unauth') return unauthorized();
  if (auth === 'forbidden') return forbidden();

  if (q.get('verify') === '1') {
    const result = await verifyAuditChain();
    return ok(result);
  }

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