/**
 * Supplier costing (fin_supplier_cost). GET with filters; POST creates an
 * invoice (UNPAID, PENDING approval per Revisi #6). unpaid = total - paid.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler, forbidden, missingRef } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertOutlet, assertSupplier } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'supplier_cost')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const brandId = scope.brandId ?? q.get('brand_id') ?? '';
  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';
  const status = (q.get('status') ?? '').toUpperCase();
  const supplierId = q.get('supplier_id') ?? '';

  let rows = await readTab<Record<string, string>>(TABS.supplierCost);
  rows = rows.filter((r) =>
    (!from || r.date_order >= from) && (!to || r.date_order <= to)
    && (!brandId || r.brand_id === brandId)
    && (!outletId || r.outlet_id === outletId)
    && (!status || (r.payment_status ?? '').toUpperCase() === status)
    && (!supplierId || r.supplier_id === supplierId)
  );
  rows.sort((a, b) => (b.date_order ?? '').localeCompare(a.date_order ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'supplier_cost')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.date_order || !/^\d{4}-\d{2}-\d{2}$/.test(body.date_order)) return badRequest('date_order (YYYY-MM-DD) is required');
  if (!body.outlet_id) return badRequest('outlet_id is required');
  if (!body.supplier_id) return badRequest('supplier_id is required');
  const total = Math.trunc(Number(body.total_amount) || 0);
  if (total <= 0) return badRequest('total_amount must be > 0');

  try {
    await assertOutlet(body.outlet_id);
    await assertSupplier(body.supplier_id);
  } catch (e) {
    if (e instanceof MissingRefError) return missingRef(e.message);
    throw e;
  }

  const [outlets, brands, suppliers] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.suppliers)
  ]);
  const outlet = outlets.find((o) => o.outlet_id === body.outlet_id);
  const brand = brands.find((b) => b.brand_id === outlet?.brand_id);
  const supplier = suppliers.find((x) => x.supplier_id === body.supplier_id);

  const paid = Math.max(0, Math.trunc(Number(body.paid_amount) || 0));
  const unpaid = Math.max(0, total - paid);
  const status = paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

  const id = nextSequentialIdSync('SUPC');
  const t = nowTimestampWib();
  const row: Record<string, string> = {
    costing_id: id,
    date_order: body.date_order,
    brand_id: outlet?.brand_id ?? '',
    brand_name: brand?.brand_name ?? '',
    outlet_id: body.outlet_id,
    outlet_name: outlet?.outlet_name ?? '',
    supplier_id: body.supplier_id,
    supplier_name: supplier?.supplier_name ?? '',
    description: body.description ?? '',
    category: body.category ?? supplier?.category ?? '',
    qty: body.qty ?? '1',
    unit: body.unit ?? '',
    unit_price: body.unit_price ?? String(total),
    total_amount: String(total),
    paid_amount: String(Math.min(paid, total)),
    unpaid_amount: String(unpaid),
    payment_status: status,
    due_date: body.due_date ?? '',
    bank_account: body.bank_account ?? supplier?.bank_account ?? '',
    invoice_number: body.invoice_number ?? '',
    invoice_url: body.invoice_url ?? '',
    receipt_url: body.receipt_url ?? '',
    approval_status: status === 'PAID' ? 'APPROVED' : 'PENDING',
    approved_by: '',
    payment_date: '',
    payment_ref: '',
    notes: body.notes ?? '',
    source_module: body.source_module ?? 'supplier',
    source_transaction_id: body.source_transaction_id ?? '',
    payment_source: body.payment_source ?? '',
    linked_expense_id: body.linked_expense_id ?? '',
    linked_petty_cash_id: body.linked_petty_cash_id ?? '',
    created_by: s.userId,
    created_at: t,
    updated_at: t
  };
  await appendRows(TABS.supplierCost, [row]);
  await logAudit({
    module: 'finance', action: 'create', recordType: 'fin_supplier_cost',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
