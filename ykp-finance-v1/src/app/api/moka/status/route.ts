/**
 * GET /api/moka/status — is the Moka feature available, is a merchant connected?
 * Used by the POS page to toggle Connect / Sync / Disconnect controls.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { isMokaConfigured, getActiveBinding } from '@/lib/moka-auth';
import { ok, handler } from '@/lib/http';

export const GET = handler(async (_req: NextRequest) => {
  const s = await getSession();
  if (!s) {
    return ok({ configured: false, connected: false }, 200);
  }
  const configured = isMokaConfigured();
  const binding = configured ? await getActiveBinding() : null;
  return ok({
    configured,
    connected: Boolean(binding),
    merchant_id: binding?.merchant_id ?? '',
    connected_at: binding?.connected_at ?? '',
    expires_at: binding?.expires_at ?? '',
  });
});