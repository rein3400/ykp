/**
 * Audit trail read endpoint (owner layer).
 * GET /api/ops/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 * Auth: valid x-bot-secret (Hermez/owner layer) OR a session cookie.
 * Note: ops audit schema uses `timestamp` (not `created_at`).
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler, unauthorized } from '@/lib/http';
import { verifyAuditChain } from '@/lib/audit';

const MAX_LIMIT = 500;

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

export const GET = handler(async (req) => {
  if (!botAuthorized(req)) {
    const { getSession } = await import('@/lib/session');
    const s = await getSession();
    if (!s) return unauthorized();
  }
  const q = new URL(req.url).searchParams;
  // ?verify=1 → run the tamper-evidence hash-chain check instead of listing.
  if (q.get('verify') === '1') {
    const verification = await verifyAuditChain();
    return list([{ ...verification, broken_at: verification.brokenAt ? JSON.stringify(verification.brokenAt) : '' }]);
  }
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const limit = Math.min(Math.max(Number(q.get('limit') ?? '200') || 200, 1), MAX_LIMIT);
  let rows = await readTab<Record<string, string>>(TABS.auditLog);
  if (from) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => (r.timestamp ?? '').slice(0, 10) <= to);
  rows.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
  return list(rows.slice(0, limit));
});
