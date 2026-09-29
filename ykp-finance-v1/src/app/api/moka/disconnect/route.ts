/**
 * POST /api/moka/disconnect — soft-disconnect the Moka binding (rows kept
 * for audit trail). Owner/finance only.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { disconnectAll } from '@/lib/moka-auth';
import { ok, handler, forbidden } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';

export const POST = handler(async (_req: NextRequest) => {
  const s = await getSession();
  if (!s) return forbidden('Unauthorized');
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');

  const n = await disconnectAll();
  await logAudit({
    module: 'finance', action: 'moka:disconnect', recordType: 'finance_moka_auth',
    recordId: `disconnect-${nowTimestampWib()}`,
    afterValue: JSON.stringify({ disconnected: n }),
    userId: s.userId,
  }).catch(() => null);
  return ok({ disconnected: n });
});