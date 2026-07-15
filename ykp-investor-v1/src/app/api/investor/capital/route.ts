import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, forbidden, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, assertInvestor } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.capital);
  // investor role: only own capital
  const filtered = s.role === 'investor' && s.investorId ? rows.filter((r) => r.investor_id === s.investorId) : rows;
  return list(filtered);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can record capital');
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  await assertInvestor(body.investor_id).catch(() => {});
  const id = nextSequentialIdSync('CAP');
  const row = {
    capital_id: id,
    investor_id: body.investor_id ?? '',
    date: body.date ?? formatDateWib(new Date()),
    type: body.type === 'out' ? 'out' : 'in',
    amount: body.amount ?? '0',
    method: body.method ?? '',
    reference: body.reference ?? '',
    note: body.note ?? '',
    created_by: s.userId,
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.capital, [row]);
  await logAudit({ actorUserId: s.userId, actorRole: s.role, action: 'create', entity: 'capital', entityId: id, afterValue: JSON.stringify(row) }).catch(() => null);
  return ok(row, 201);
});