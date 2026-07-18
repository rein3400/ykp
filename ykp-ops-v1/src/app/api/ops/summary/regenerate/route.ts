import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, handler, unauthorized, forbidden } from '@/lib/http';
import { generateDailySummary } from '@/lib/ops-summary';
import { logAudit } from '@/lib/audit';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'generate', 'summary')) return forbidden();
  const body = (await req.formData().catch(() => new FormData()));
  const date = body.get('date') as string | null;
  const items = await generateDailySummary({ date: date ?? undefined });
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'generate',
    entity: 'ops_daily_summary',
    entityId: date ?? 'today',
    afterValue: JSON.stringify({ count: items.length }),
  }).catch(() => null);
  return ok({ items, count: items.length });
});
