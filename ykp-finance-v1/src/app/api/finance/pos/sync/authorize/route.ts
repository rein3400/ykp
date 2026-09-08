/**
 * POST /api/finance/pos/sync/authorize — one-time Moka authorization
 * (spec finance/moka-sync: alur otorisasi sekali-jalankan).
 *
 * Body: { outlet: <KEY>, code?: string, redirect_uri?: string }
 *  - with code: exchange App Market authorization code → store tokens
 *  - without code: probe client_credentials grant → store tokens if supported
 *
 * Auth: admin session (pos import) OR x-moka-sync-secret, same as sync.
 */
import { NextRequest } from 'next/server';
import { ok, unauthorized, forbidden, notFound, badRequest, handler } from '@/lib/http';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { authorizeMokaOutlet } from '@/lib/moka-sync';

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

  const body = (await req.json().catch(() => ({}))) as { outlet?: string; code?: string; redirect_uri?: string };
  if (!body.outlet?.trim()) return badRequest('outlet (env key) is required');

  const result = await authorizeMokaOutlet({
    outletKey: body.outlet.trim(),
    code: body.code?.trim() || undefined,
    redirectUri: body.redirect_uri?.trim() || undefined,
    actor
  });

  await logAudit({
    module: 'finance',
    action: result.ok ? 'moka_authorize' : 'moka_authorize_failed',
    recordType: 'app_settings',
    recordId: `moka_token:${body.outlet.trim()}`,
    afterValue: JSON.stringify({ ok: result.ok, mode: result.mode }),
    userId: actor
  }).catch(() => null);

  return ok(result);
});