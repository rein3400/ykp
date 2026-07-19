/**
 * Supplier cost row: PATCH (edit fields / record partial payment), DELETE
 * (finance_admin+, audited). Approve-payment lives in ./approve-payment.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

const EDITABLE = [
  'date_order', 'description', 'category', 'qty', 'unit', 'unit_price',
  'due_date', 'bank_account', 'invoice_number', 'invoice_url', 'receipt_url', 'notes'
] as const;

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'supplier_cost')) return forbidden('Forbidden');

  const found = await findRow(TABS.supplierCost, 'costing_id', params.id);
  if (!found) return notFound(`costing_id not found: ${params.id}`);

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const before = { ...found.row };
  const next = { ...found.row };

  for (const k of EDITABLE) {
    if (body[k] !== undefined) next[k] = body[k];
  }
  // Record an additional payment (partial allowed, Revisi #6)
  if (body.add_payment !== undefined) {
    const add = Math.trunc(Number(body.add_payment) || 0);
    if (add <= 0) return badRequest('add_payment must be > 0');
    const total = Number(next.total_amount || 0);
    const paid = Math.min(total, Number(next.paid_amount || 0) + add);
    next.paid_amount = String(paid);
    next.unpaid_amount = String(Math.max(0, total - paid));
    next.payment_status = paid >= total ? 'PAID' : 'PARTIAL';
    if (body.payment_date) next.payment_date = body.payment_date;
    if (body.payment_ref) next.payment_ref = body.payment_ref;
    if (body.payment_source) next.payment_source = body.payment_source;
  }
  next.updated_at = nowTimestampWib();

  await updateRow(TABS.supplierCost, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: 'update', recordType: 'fin_supplier_cost',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: body.reason ?? '', userId: s.userId
  }).catch(() => null);
  return ok(next);
});

export const DELETE = handler(async (_req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'delete', 'supplier_cost')) return forbidden('Forbidden');

  const found = await findRow(TABS.supplierCost, 'costing_id', params.id);
  if (!found) return notFound(`costing_id not found: ${params.id}`);
  if (found.row.payment_status === 'PAID') return badRequest('Invoice PAID tidak bisa dihapus — batalkan lewat approval.');

  const before = { ...found.row };
  const next = { ...found.row, payment_status: 'CANCELLED', approval_status: 'CANCELLED', unpaid_amount: '0', updated_at: nowTimestampWib() };
  await updateRow(TABS.supplierCost, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: 'delete', recordType: 'fin_supplier_cost',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    userId: s.userId
  }).catch(() => null);
  return ok(next);
});
