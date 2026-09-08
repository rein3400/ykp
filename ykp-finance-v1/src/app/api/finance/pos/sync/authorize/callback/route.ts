/**
 * GET /api/finance/pos/sync/authorize/callback?state=<KEY>&code=<code>
 * Owner consent lands here (redirect_uri registered on the Moka app).
 * Exchanges the code for tokens, stores per outlet, shows a tiny result page.
 * Registered redirect URI must equal this endpoint's URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { handler, badRequest, ok } from '@/lib/http';
import { authorizeMokaOutlet } from '@/lib/moka-sync';

function page(title: string, detail: string, isError: boolean): NextResponse {
  const bg = isError ? '#b91c1c' : '#15803d';
  const html = `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;max-width:32rem;margin:10vh auto;text-align:center">
<h1 style="color:${bg}">${title}</h1><p>${detail}</p></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const GET = handler(async (req: NextRequest) => {
  if (process.env.MOKA_SYNC_ENABLED !== 'true') {
    return page('Sync nonaktif', 'Set MOKA_SYNC_ENABLED=true terlebih dahulu.', true);
  }

  const code = req.nextUrl.searchParams.get('code')?.trim();
  const outlet = req.nextUrl.searchParams.get('state')?.trim();
  if (!code || !outlet) return badRequest('code dan state (outlet key) wajib ada');

  const redirectUri =
    process.env.MOKA_REDIRECT_URI?.trim() ||
    `${req.nextUrl.origin}/api/finance/pos/sync/authorize/callback`;

  const result = await authorizeMokaOutlet({ outletKey: outlet, code, redirectUri, actor: 'oauth-callback' });
  if (!result.ok) {
    return page('Gagal', `Otorisasi ${outlet} gagal: ${result.error}`, true);
  }
  return page('Otorisasi berhasil', `${outlet}: token tersimpan (${result.mode}). Sync siap jalan.`, false);
});