import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, forbidden, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.dividend);
  const filtered = s.role === 'investor' && s.investorId ? rows.filter((r) => r.investor_id === s.investorId) : rows;
  return list(filtered);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can declare dividend');
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const id = nextSequentialIdSync('DVD');
  const status = body.status === 'paid' ? 'paid' : 'declared';
  const row = {
    dividend_id: id,
    investor_id: body.investor_id ?? '',
    period: body.period ?? '',
    amount: body.amount ?? '0',
    status,
    declared_at: nowTimestampWib(),
    paid_at: status === 'paid' ? nowTimestampWib() : '',
    reference: body.reference ?? '',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.dividend, [row]);
  await logAudit({ actorUserId: s.userId, actorRole: s.role, action: 'create', entity: 'dividend', entityId: id, afterValue: JSON.stringify(row) }).catch(() => null);
  try {
    const { regenerateInvestorSummary } = await import('@/lib/investor-summary');
    await regenerateInvestorSummary();
  } catch { /* non-blocking */ }
  return ok(row, 201);
});