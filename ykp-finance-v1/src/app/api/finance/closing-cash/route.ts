/**
 * Closing cash (fin_closing_cash) — physical vs system per blueprint §7.4:
 * expected = opening_cash + cash_revenue_in - cash_expense_out - petty_cash_out
 * cash_difference = physical_cash - expected_cash (signed).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler, forbidden, missingRef } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertOutlet } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { isInactiveStatus, num } from '@/lib/fin-summary';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'closing_cash')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';

  let rows = await readTab<Record<string, string>>(TABS.closingCash);
  rows = rows.filter((r) =>
    (!from || r.date >= from) && (!to || r.date <= to)
    && (!scope.brandId || r.brand_id === scope.brandId)
    && (!outletId || r.outlet_id === outletId)
  );
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'closing_cash')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return badRequest('date (YYYY-MM-DD) is required');
  if (!body.outlet_id) return badRequest('outlet_id is required');
  const physical = Math.trunc(Number(body.physical_cash));
  if (!Number.isFinite(physical) || physical < 0) return badRequest('physical_cash must be >= 0');

  try {
    await assertOutlet(body.outlet_id);
  } catch (e) {
    if (e instanceof MissingRefError) return missingRef(e.message);
    throw e;
  }

  const [outlets, pos, expenses, petty, closings, methods] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.posDaily),
    readTab<Record<string, string>>(TABS.expense),
    readTab<Record<string, string>>(TABS.pettyCash),
    readTab<Record<string, string>>(TABS.closingCash),
    readTab<Record<string, string>>(TABS.paymentMethods)
  ]);
  const outlet = outlets.find((o) => o.outlet_id === body.outlet_id);

  // Opening defaults to previous day's physical cash
  const prev = closings
    .filter((c) => c.outlet_id === body.outlet_id && c.date < body.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
  const opening = body.opening_cash !== undefined && body.opening_cash !== ''
    ? Math.trunc(Number(body.opening_cash))
    : Number(prev?.physical_cash || 0);

  const posCash = pos
    .filter((p) => p.date === body.date && p.outlet_id === body.outlet_id)
    .reduce((sum, p) => sum + num(p.settle_cash), 0);

  const cashMethodIds = new Set(methods.filter((m) => m.is_cash === 'true').map((m) => m.method_id));
  const cashExpenseOut = expenses
    .filter((e) => e.date === body.date && e.outlet_id === body.outlet_id
      && cashMethodIds.has(e.payment_method)
      && !isInactiveStatus(e.approval_status) && !isInactiveStatus(e.status))
    .reduce((sum, e) => sum + num(e.amount), 0);

  const pettyOut = petty
    .filter((p) => p.date === body.date && p.outlet_id === body.outlet_id
      && !isInactiveStatus(p.approval_status)
      && !p.linked_expense_id && !p.linked_supplier_invoice_id)
    .reduce((sum, p) => sum + num(p.credit_out), 0);

  const expected = opening + posCash - cashExpenseOut - pettyOut;
  const difference = physical - expected;

  const id = nextSequentialIdSync('CLS');
  const row: Record<string, string> = {
    closing_id: id,
    date: body.date,
    brand_id: outlet?.brand_id ?? '',
    outlet_id: body.outlet_id,
    outlet_name: outlet?.outlet_name ?? '',
    opening_cash: String(opening),
    pos_cash_sales: String(posCash),
    cash_revenue_in: String(posCash),
    cash_expense_out: String(cashExpenseOut),
    petty_cash_out: String(pettyOut),
    expected_cash: String(expected),
    physical_cash: String(physical),
    cash_difference: String(difference),
    notes: body.notes ?? '',
    recorded_by: s.userId,
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.closingCash, [row]);
  await logAudit({
    module: 'finance', action: 'create', recordType: 'fin_closing_cash',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
