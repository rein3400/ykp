/**
 * GET /api/finance/pos/sync/authorize/start?outlet=<KEY>&redirect_uri=<url>
 * Builds the Moka consent URL (Doorkeeper /oauth/authorize) for the owner to
 * open in a browser, click Allow, and land on the callback that stores the
 * token. redirect_uri must match the one registered on the Moka app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { handler, badRequest, notFound } from '@/lib/http';
import { mokaApiBase } from '@/lib/moka-client';
import { parseOutletKeys } from '@/lib/moka-client';

export const GET = handler(async (req: NextRequest) => {
  if (process.env.MOKA_SYNC_ENABLED !== 'true') {
    return notFound('Moka sync disabled (set MOKA_SYNC_ENABLED=true)');
  }

  const outlet = req.nextUrl.searchParams.get('outlet')?.trim();
  if (!outlet) return badRequest('outlet (env key) is required');
  const { configured } = parseOutletKeys();
  const cfg = configured.find((c) => c.key === outlet);
  if (!cfg) return badRequest(`outlet '${outlet}' tidak ditemukan atau konfigurasi env tidak lengkap`);

  const redirectUri =
    req.nextUrl.searchParams.get('redirect_uri')?.trim() ||
    process.env.MOKA_REDIRECT_URI?.trim();
  if (!redirectUri) {
    return badRequest('redirect_uri required (query param or MOKA_REDIRECT_URI env, must match the app registration)');
  }

  const url = new URL(`${mokaApiBase()}/oauth/authorize`);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'report');
  url.searchParams.set('state', cfg.key);
  return NextResponse.redirect(url.toString());
});