import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
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
  // Validate required fields + numeric amount (integer IDR — invariant §2).
  const investorId = (body.investor_id ?? '').trim();
  const period = (body.period ?? '').trim();
  if (!investorId) return badRequest('investor_id wajib diisi');
  if (!period) return badRequest('period wajib diisi');
  const rawAmount = body.amount ?? '';
  if (!/^-?\d+$/.test(rawAmount)) return badRequest('amount harus integer IDR (mis. "500000")');
  const amount = Number(rawAmount);
  const id = nextSequentialIdSync('DVD');
  const status = body.status === 'paid' ? 'paid' : 'declared';
  const row = {
    dividend_id: id,
    investor_id: investorId,
    period,
    amount: String(amount),
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

/**
 * Status transitions (owner only): proposed → declared → paid.
 * PUT { dividend_id, action: 'declare' | 'pay' }
 */
export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can update dividend status');

  const body = (await req.json().catch(() => ({}))) as { dividend_id?: string; action?: string };
  const id = (body.dividend_id ?? '').trim();
  if (!id) return badRequest('dividend_id wajib diisi');
  const action = body.action ?? '';
  if (action !== 'declare' && action !== 'pay') return badRequest("action harus 'declare' atau 'pay'");

  const found = await findRow(TABS.dividend, 'dividend_id', id);
  if (!found) return notFound(`Dividend tidak ditemukan: ${id}`);
  const row = found.row;
  const now = nowTimestampWib();

  if (action === 'declare') {
    if (row.status !== 'proposed') return badRequest(`Hanya status 'proposed' yang bisa dideklarasi (sekarang: ${row.status})`);
    row.status = 'declared';
    row.declared_at = now;
  } else {
    if (row.status !== 'declared') return badRequest(`Hanya status 'declared' yang bisa dibayar (sekarang: ${row.status})`);
    row.status = 'paid';
    row.paid_at = now;
  }
  await updateRow(TABS.dividend, found.rowNumber, row);
  await logAudit({
    actorUserId: s.userId, actorRole: s.role, action: 'update', entity: 'dividend', entityId: id,
    afterValue: JSON.stringify({ status: row.status })
  }).catch(() => null);
  return ok(row);
});