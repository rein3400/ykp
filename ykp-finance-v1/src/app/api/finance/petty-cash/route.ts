/**
 * Petty cash (fin_petty_cash) — running balance per account (Revisi #7:
 * brand/outlet/account/date). GET with filters; POST adds top-up (debit) or
 * cash-out (credit) and recomputes running_balance for the account.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler, forbidden, missingRef } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertPettyCashAccount } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'petty_cash')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const brandId = scope.brandId ?? q.get('brand_id') ?? '';
  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';
  const accountId = q.get('account_id') ?? '';
  const type = q.get('type') ?? ''; // debit | credit | urgent

  let rows = await readTab<Record<string, string>>(TABS.pettyCash);
  rows = rows.filter((r) =>
    (!from || r.date >= from) && (!to || r.date <= to)
    && (!brandId || r.brand_id === brandId)
    && (!outletId || r.outlet_id === outletId)
    && (!accountId || r.account_id === accountId)
    && (!type
      || (type === 'debit' && Number(r.debit_topup) > 0)
      || (type === 'credit' && Number(r.credit_out) > 0)
      || (type === 'urgent' && r.urgent_flag === 'true'))
  );
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'petty_cash')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return badRequest('date (YYYY-MM-DD) is required');
  if (!body.account_id) return badRequest('account_id is required');
  const debit = Math.max(0, Math.trunc(Number(body.debit_topup) || 0));
  const credit = Math.max(0, Math.trunc(Number(body.credit_out) || 0));
  if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
    return badRequest('Isi salah satu: debit_topup (top up) atau credit_out (pengeluaran)');
  }
  if (!body.description) return badRequest('description is required');

  try {
    await assertPettyCashAccount(body.account_id);
  } catch (e) {
    if (e instanceof MissingRefError) return missingRef(e.message);
    throw e;
  }

  const [accounts, outlets, brands, pettyRows] = await Promise.all([
    readTab<Record<string, string>>(TABS.pettyCashAccounts),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.pettyCash)
  ]);
  const account = accounts.find((a) => a.account_id === body.account_id);
  const outlet = outlets.find((o) => o.outlet_id === account?.outlet_id);
  const brand = brands.find((b) => b.brand_id === (account?.brand_id || outlet?.brand_id));

  // Running balance per account (Revisi #7) — brand + outlet + account + tanggal
  const last = pettyRows
    .filter((p) => p.account_id === body.account_id)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .at(-1);
  const prevBalance = Number(last?.running_balance || account?.opening_balance || 0);
  const newBalance = prevBalance + debit - credit;
  if (newBalance < 0) return badRequest(`Saldo kas kecil tidak cukup (saldo ${prevBalance}, keluar ${credit})`);

  const id = nextSequentialIdSync('PC');
  const row: Record<string, string> = {
    petty_id: id,
    date: body.date,
    brand_id: account?.brand_id || outlet?.brand_id || '',
    brand_name: brand?.brand_name ?? '',
    outlet_id: account?.outlet_id ?? '',
    outlet_name: outlet?.outlet_name ?? '',
    account_id: body.account_id,
    description: body.description,
    category: body.category ?? 'Operational',
    qty: body.qty ?? '1',
    unit: body.unit ?? '',
    debit_topup: String(debit),
    credit_out: String(credit),
    running_balance: String(newBalance),
    physical_cash: '',
    cash_difference: '',
    closing_status: '',
    cash_on_hand_status: 'OK',
    receipt_url: body.receipt_url ?? '',
    urgent_flag: body.urgent_flag === 'true' ? 'true' : 'false',
    // Urgent petty cash requires approval (brief §10)
    approval_status: body.urgent_flag === 'true' ? 'PENDING' : 'APPROVED',
    approved_by: body.urgent_flag === 'true' ? '' : s.userId,
    notes: body.notes ?? '',
    source_module: body.source_module ?? 'petty_cash',
    source_transaction_id: body.source_transaction_id ?? '',
    payment_source: body.payment_source ?? '',
    linked_expense_id: body.linked_expense_id ?? '',
    linked_supplier_invoice_id: body.linked_supplier_invoice_id ?? '',
    created_by: s.userId,
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.pettyCash, [row]);
  await logAudit({
    module: 'finance', action: 'create', recordType: 'fin_petty_cash',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
