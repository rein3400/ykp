/**
 * POST /api/finance/pos/sync — Moka API → Sheets sync (spec finance/moka-sync).
 * Body: {date?: YYYY-MM-DD, outlet?: string} — date defaults to today (WIB),
 * outlet narrows the run to one configured Moka app.
 *
 * Auth (route-level; middleware allowlists this path):
 *   - session with pos import permission (manual admin trigger), OR
 *   - header x-moka-sync-secret matching MOKA_SYNC_SECRET (platform cron)
 *
 * Gated by MOKA_SYNC_ENABLED=true; when off the endpoint reports 404 so the
 * CSV import remains the only ingestion path (rollback switch).
 */
import { NextRequest } from 'next/server';
import { ok, unauthorized, forbidden, notFound, badRequest, handler } from '@/lib/http';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { todayWib } from '@/lib/format';
import { runMokaSync } from '@/lib/moka-sync';

export const POST = handler(async (req: NextRequest) => {
  if (process.env.MOKA_SYNC_ENABLED !== 'true') {
    return notFound('Moka sync disabled (set MOKA_SYNC_ENABLED=true)');
  }

  const secret = process.env.MOKA_SYNC_SECRET?.trim();
  const headerSecret = req.headers.get('x-moka-sync-secret')?.trim() ?? '';
  const isServiceCall = Boolean(secret && headerSecret && headerSecret === secret);

  let actor = 'cron';
  if (!isServiceCall) {
    const s = await getSession();
    if (!s) return unauthorized();
    if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');
    actor = s.userId;
  }

  const body = (await req.json().catch(() => ({}))) as { date?: string; outlet?: string };
  const date = (body.date ?? '').trim() || todayWib();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD');

  const result = await runMokaSync({ date, outletKey: body.outlet?.trim() || undefined, actor });

  await logAudit({
    module: 'finance',
    action: 'moka_sync',
    recordType: 'fin_pos_daily',
    recordId: `moka-sync-${date}`,
    afterValue: JSON.stringify(result),
    userId: actor
  }).catch(() => null);

  return ok(result);
});