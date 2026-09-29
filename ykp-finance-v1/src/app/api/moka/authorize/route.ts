/**
 * GET /api/moka/authorize — start the Moka connection flow (302 to consent).
 * Requires an admin-level session; Moka env must be configured.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isMokaConfigured, mokaConfig, MOKA_SCOPES, createState } from '@/lib/moka-auth';

export const GET = async () => {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Unauthorized' } }, { status: 401 });
  }
  if (!isMokaConfigured()) {
    return NextResponse.json({ error: { code: 'not_configured', message: 'MOKA_CLIENT_ID / MOKA_CLIENT_SECRET / MOKA_REDIRECT_URI belum di-set di env' } }, { status: 400 });
  }
  const cfg = mokaConfigNonNull();
  const state = createState();
  const url = new URL('https://www.mokapos.com/open_api/authorize');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', MOKA_SCOPES);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('state', state);
  return NextResponse.redirect(url.toString());
};

function mokaConfigNonNull() {
  const cfg = mokaConfig();
  if (!cfg) throw new Error('unreachable after isMokaConfigured');
  return cfg;
}