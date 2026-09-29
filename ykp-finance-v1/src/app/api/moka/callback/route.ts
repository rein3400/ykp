/**
 * GET /api/moka/callback — Moka redirects here with ?code=&state= after consent.
 * Exchanges the code for tokens, stores one merchant binding, redirects to POS.
 * No session: Moka lands here in a fresh tab after consent. The one-time state
 * check is the CSRF boundary.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isMokaConfigured, mokaConfig, consumeState, exchangeCode, saveBinding, type MokaBinding } from '@/lib/moka-auth';
import { nowTimestampWib } from '@/lib/format';

const POS_URL = '/finance/pos';

function fail(origin: string, msg: string) {
  return NextResponse.redirect(`${origin}${POS_URL}?moka_error=${encodeURIComponent(msg)}`);
}

export const GET = async (req: NextRequest) => {
  const origin = new URL(req.url).origin;
  const back = `${origin}${POS_URL}`;
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const errParam = req.nextUrl.searchParams.get('error');

  if (errParam) return fail(origin, `Moka menolak koneksi: ${errParam}`);
  if (!code || !state) return fail(origin, 'Kode otorisasi tidak lengkap');
  if (!consumeState(state)) return fail(origin, 'State kedaluwarsa — hubungkan ulang dari halaman POS');
  if (!isMokaConfigured()) return fail(origin, 'MOKA_CLIENT_ID / SECRET / REDIRECT_URI belum di-set');

  const cfg = mokaConfigNonNull();
  const token = await exchangeCode(code, cfg);
  if (token.status !== 200 || !token.body.access_token) {
    const desc = token.body.error_description ?? token.body.error ?? `HTTP ${token.status}`;
    return fail(origin, `Gagal menukar kode otorisasi: ${desc}`);
  }

  const now = nowTimestampWib();
  const binding: MokaBinding = {
    id: `MK-${Date.now().toString(36).toUpperCase()}`,
    merchant_id: `merchant-${Date.now().toString(36)}`,
    merchant_name: '',
    business_id: '',
    outlet_ids: '',
    access_token: token.body.access_token,
    refresh_token: token.body.refresh_token ?? '',
    expires_at: String(Math.floor(Date.now() / 1000) + (token.body.expires_in ?? 86400)),
    scope: token.body.scope ?? '',
    connected_by: 'oauth',
    connected_at: now,
    disconnected_at: '',
    updated_at: now,
  };
  await saveBinding(binding);

  return NextResponse.redirect(`${back}?moka=connected`);
};

function mokaConfigNonNull() {
  const cfg = mokaConfig();
  if (!cfg) throw new Error('unreachable after isMokaConfigured');
  return cfg;
}