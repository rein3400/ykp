/**
 * Expense log (fin_expense) — 15 categories per brief §6.5. GET with filters;
 * POST creates an expense (amount above outlet tier arrives as PENDING
 * approval per brief §10).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler, forbidden, missingRef } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertOutlet, assertExpenseCategory } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { sendViaGateway } from '@/lib/notify-gateway';
import { formatIdr } from '@/lib/format';

/** Escape HTML-significant chars in dynamic text sent through the gateway. */
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'expense')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const brandId = scope.brandId ?? q.get('brand_id') ?? '';
  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';
  const category = q.get('category') ?? '';
  const method = q.get('payment_method') ?? '';
  const approval = (q.get('approval_status') ?? '').toUpperCase();

  let rows = await readTab<Record<string, string>>(TABS.expense);
  rows = rows.filter((r) =>
    (!from || r.date >= from) && (!to || r.date <= to)
    && (!brandId || r.brand_id === brandId)
    && (!outletId || r.outlet_id === outletId)
    && (!category || r.expense_category === category)
    && (!method || r.payment_method === method)
    && (!approval || (r.approval_status ?? '').toUpperCase() === approval)
  );
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'expense')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return badRequest('date (YYYY-MM-DD) is required');
  if (!body.outlet_id) return badRequest('outlet_id is required');
  if (!body.expense_category) return badRequest('expense_category is required');
  const amount = Math.trunc(Number(body.amount) || 0);
  if (amount <= 0) return badRequest('amount must be > 0');

  try {
    await assertOutlet(body.outlet_id);
    await assertExpenseCategory(body.expense_category);
  } catch (e) {
    if (e instanceof MissingRefError) return missingRef(e.message);
    throw e;
  }

  const [outlets, brands] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands)
  ]);
  const outlet = outlets.find((o) => o.outlet_id === body.outlet_id);
  const brand = brands.find((b) => b.brand_id === outlet?.brand_id);

  // Expense di atas limit outlet (Rp500.000) wajib approval (brief §10)
  const needsApproval = amount > 500_000;
  const id = nextSequentialIdSync('EXP');
  const t = nowTimestampWib();
  const row: Record<string, string> = {
    expense_id: id,
    date: body.date,
    brand_id: outlet?.brand_id ?? '',
    brand_name: brand?.brand_name ?? '',
    outlet_id: body.outlet_id,
    outlet_name: outlet?.outlet_name ?? '',
    expense_category: body.expense_category,
    description: body.description ?? '',
    amount: String(amount),
    payment_method: body.payment_method ?? 'PM-CASH',
    receipt_url: body.receipt_url ?? '',
    approval_status: needsApproval ? 'PENDING' : 'APPROVED',
    approved_by: needsApproval ? '' : s.userId,
    status: 'ACTIVE',
    notes: body.notes ?? '',
    source_module: body.source_module ?? 'expense',
    source_transaction_id: body.source_transaction_id ?? '',
    payment_source: body.payment_source ?? '',
    linked_supplier_invoice_id: body.linked_supplier_invoice_id ?? '',
    linked_petty_cash_id: body.linked_petty_cash_id ?? '',
    created_by: s.userId,
    created_at: t,
    updated_at: t
  };
  await appendRows(TABS.expense, [row]);

  // Fase 4: PENDING expense di atas limit → Telegram approval request via
  // Hermez gateway (owner chat, fire-and-forget — never blocks the create).
  if (needsApproval) {
    void sendViaGateway({
      message_type: 'APPROVAL_REQUEST',
      source_module: 'finance',
      roles: 'owner',
      brand_id: row.brand_id || undefined,
      message: [
        `<b>Permintaan Approval Expense</b>`,
        `${row.description ? escapeHtmlText(row.description) + '\n' : ''}`,
        `Kategori: <b>${escapeHtmlText(row.expense_category)}</b> | Nominal: <b>${formatIdr(amount)}</b>`,
        `Outlet: ${escapeHtmlText(row.outlet_name)} | Tanggal: ${row.date}`,
        `ID: <code>${id}</code>`
      ].filter(Boolean).join('\n'),
      approval: {
        entity: 'expense',
        record_id: id,
        title: `Expense ${row.expense_category} — ${formatIdr(amount)} (${row.outlet_name})`,
        detail: {
          Kategori: row.expense_category,
          Nominal: formatIdr(amount),
          Outlet: row.outlet_name,
          Tanggal: row.date,
          ...(row.description ? { Keterangan: row.description } : {})
        },
        allowed_roles: ['owner', 'super_admin', 'finance_admin']
      }
    }).catch(() => undefined);
  }

  await logAudit({
    module: 'finance', action: 'create', recordType: 'fin_expense',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
