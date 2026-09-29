import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, handler, unauthorized, forbidden, badRequest } from '@/lib/http';
import { generateDailySummary } from '@/lib/ops-summary';
import { logAudit } from '@/lib/audit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'generate', 'summary')) return forbidden();

  const raw = await req.text().catch(() => '');
  let date: string | undefined;
  if (raw.trim()) {
    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      const fd = new FormData();
      raw.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) fd.append(decodeURIComponent(k), decodeURIComponent(v ?? ''));
      });
      parsedBody = fd;
    }
    if (parsedBody instanceof FormData) {
      const v = parsedBody.get('date');
      if (typeof v === 'string' && v.trim()) date = v.trim();
    } else if (parsedBody && typeof parsedBody === 'object') {
      const d = (parsedBody as Record<string, unknown>).date;
      if (d !== undefined && d !== null) {
        if (typeof d !== 'string' || !DATE_RE.test(d)) return badRequest('date must be YYYY-MM-DD');
        date = d;
      }
    }
  }

  const items = await generateDailySummary({ date });
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