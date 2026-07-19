/**
 * POS revenue (fin_pos_daily). GET with filters; POST manual entry.
 * Net Sales = Gross - Discount - Refund - Void (brief §6.2).
 * Settlement validated per Revisi #5; unique per (date, outlet).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, conflict, handler, forbidden, missingRef } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError } from '@/lib/repo';
import { assertOutlet } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { computeSettlement } from '@/lib/settlement';
import { z } from 'zod';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'pos')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const brandId = scope.brandId ?? q.get('brand_id') ?? '';
  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';
  const source = q.get('source') ?? '';

  let rows = await readTab<Record<string, string>>(TABS.posDaily);
  rows = rows.filter((r) =>
    (!from || r.date >= from) && (!to || r.date <= to)
    && (!brandId || r.brand_id === brandId)
    && (!outletId || r.outlet_id === outletId)
    && (!source || r.source === source)
  );
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (a.outlet_id ?? '').localeCompare(b.outlet_id ?? ''));
  return list(rows);
});

const posSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outlet_id: z.string().min(1),
  gross_sales: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative().default(0),
  refund: z.number().int().nonnegative().default(0),
  void: z.number().int().nonnegative().default(0),
  tax: z.number().int().nonnegative().default(0),
  service_charge: z.number().int().nonnegative().default(0),
  settle_cash: z.number().int().nonnegative().default(0),
  settle_qris: z.number().int().nonnegative().default(0),
  settle_card: z.number().int().nonnegative().default(0),
  settle_transfer: z.number().int().nonnegative().default(0),
  settle_marketplace: z.number().int().nonnegative().default(0),
  transaction_count: z.number().int().nonnegative().default(0),
  cashier: z.string().default(''),
  shift: z.string().default(''),
  notes: z.string().default('')
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'pos')) return forbidden('Forbidden');

  const parsed = posSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const b = parsed.data;

  try {
    await assertOutlet(b.outlet_id);
  } catch (e) {
    if (e instanceof MissingRefError) return missingRef(e.message);
    throw e;
  }

  // Unique per (date, outlet)
  const existing = await readTab<Record<string, string>>(TABS.posDaily);
  if (existing.some((r) => r.date === b.date && r.outlet_id === b.outlet_id)) {
    return conflict(`POS untuk ${b.outlet_id} tanggal ${b.date} sudah ada. Edit baris yang ada atau gunakan import.`);
  }

  const outlets = await readTab<Record<string, string>>(TABS.outlets);
  const outlet = outlets.find((o) => o.outlet_id === b.outlet_id);
  const brands = await readTab<Record<string, string>>(TABS.brands);
  const brand = brands.find((x) => x.brand_id === outlet?.brand_id);

  const netSales = b.gross_sales - b.discount - b.refund - b.void;
  if (netSales < 0) return badRequest('net_sales negatif — cek gross/discount/refund/void');
  const settle = computeSettlement({
    cash: b.settle_cash, qris: b.settle_qris, card: b.settle_card,
    transfer: b.settle_transfer, marketplace: b.settle_marketplace
  }, netSales);
  const aov = b.transaction_count > 0 ? Math.round(netSales / b.transaction_count) : 0;

  const id = nextSequentialIdSync('POS');
  const t = nowTimestampWib();
  const methods: [string, number][] = [
    ['Cash', b.settle_cash], ['QRIS', b.settle_qris], ['Card', b.settle_card],
    ['Transfer', b.settle_transfer], ['Marketplace', b.settle_marketplace]
  ];
  const dominant = methods.sort((a, bb) => bb[1] - a[1])[0]?.[1] ? methods[0][0] : '';
  const row: Record<string, string> = {
    pos_id: id,
    date: b.date,
    brand_id: outlet?.brand_id ?? '',
    brand_name: brand?.brand_name ?? '',
    outlet_id: b.outlet_id,
    outlet_name: outlet?.outlet_name ?? '',
    gross_sales: String(b.gross_sales),
    net_sales: String(netSales),
    discount: String(b.discount),
    refund: String(b.refund),
    void: String(b.void),
    tax: String(b.tax),
    service_charge: String(b.service_charge),
    settle_cash: String(b.settle_cash),
    settle_qris: String(b.settle_qris),
    settle_card: String(b.settle_card),
    settle_transfer: String(b.settle_transfer),
    settle_marketplace: String(b.settle_marketplace),
    total_settlement: String(settle.totalSettlement),
    settlement_difference: String(settle.settlementDifference),
    transaction_count: String(b.transaction_count),
    aov: String(aov),
    cashier: b.cashier,
    shift: b.shift,
    payment_method: dominant,
    source: 'manual',
    source_ref: '',
    notes: b.notes,
    source_module: 'pos',
    source_transaction_id: '',
    payment_source: '',
    linked_expense_id: '',
    linked_supplier_invoice_id: '',
    linked_petty_cash_id: '',
    created_by: s.userId,
    created_at: t,
    updated_at: t
  };
  await appendRows(TABS.posDaily, [row]);
  await logAudit({
    module: 'finance', action: 'create', recordType: 'fin_pos_daily',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
