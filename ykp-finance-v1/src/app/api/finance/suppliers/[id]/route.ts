/**
 * Supplier cost row: PATCH (edit fields / record partial payment), DELETE
 * (finance_admin+, audited). Approve-payment lives in ./approve-payment.
 *
 * Bug #3: PATCH is an unguarded read-modify-write; `add_payment` and the
 * editable fields are now written via `guardedUpdateRow` (optimistic
 * concurrency on `updated_at`) so two concurrent PATCHes cannot silently
 * lose a payment or a field edit.
 * Bug #5: `unit_price`/`qty` are normalized to finite non-negative integer
 * IDR (parseIdr strips Rp/./,) and NaN is rejected instead of stored.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden, conflict } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, parseIdr } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';
import { guardedUpdateRow, ConcurrentUpdateError } from '@/lib/concurrency';

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
  // Bug #5: validate/normalize money + qty to finite non-negative integer IDR.
  if (body.unit_price !== undefined) {
    const up = parseIdr(body.unit_price);
    if (!Number.isFinite(up)) return badRequest('unit_price must be a finite number');
    next.unit_price = String(Math.max(0, Math.trunc(up)));
  }
  if (body.qty !== undefined) {
    const q = parseIdr(body.qty);
    if (!Number.isFinite(q)) return badRequest('qty must be a finite number');
    next.qty = String(Math.max(0, Math.trunc(q)));
  }
  // Record an additional payment (partial allowed, Revisi #6)
  if (body.add_payment !== undefined) {
    const add = Math.trunc(parseIdr(body.add_payment));
    if (!Number.isFinite(add) || add <= 0) return badRequest('add_payment must be > 0');
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

  // Bug #3: guard the read-modify-write so a concurrent PATCH/`add_payment`
  // that moved updated_at does not silently lose the payment or field edit.
  try {
    await guardedUpdateRow(TABS.supplierCost, 'costing_id', params.id, found, next);
  } catch (e) {
    if (e instanceof ConcurrentUpdateError) return conflict(e.message);
    throw e;
  }
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