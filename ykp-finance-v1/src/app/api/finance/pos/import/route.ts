/**
 * Moka CSV import → fin_pos_daily. Parses via lib/moka-importer (pure),
 * resolves outlet by name, skips duplicates per (date, outlet), returns the
 * variance report (dropped rows, alias guesses, duplicates).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { parseMokaCsv } from '@/lib/moka-importer';
import { computeSettlement } from '@/lib/settlement';
import { fetchSheetCsv } from '@/lib/sheet-import';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { csv?: string; sheet_url?: string };
  let csv = (body.csv ?? '').trim();
  let sheetTitle = '';
  if (!csv && body.sheet_url) {
    try {
      const fetched = await fetchSheetCsv(body.sheet_url);
      csv = fetched.csv;
      sheetTitle = fetched.title;
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : 'Gagal membaca Google Sheet');
    }
  }
  if (!csv) return badRequest('csv or sheet_url is required');

  const parsed = parseMokaCsv(csv);
  const [outlets, brands, existing] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.posDaily)
  ]);

  const t = nowTimestampWib();
  const inserted: Record<string, string>[] = [];
  const skipped: { date: string; outlet: string; reason: string }[] = [];

  for (const r of parsed.rows) {
    const outlet = outlets.find((o) => o.outlet_name.toLowerCase() === r.outletName.toLowerCase());
    if (!outlet) {
      skipped.push({ date: r.date, outlet: r.outletName, reason: 'outlet tidak ditemukan di master_outlet' });
      continue;
    }
    if (existing.some((e) => e.date === r.date && e.outlet_id === outlet.outlet_id)
      || inserted.some((e) => e.date === r.date && e.outlet_id === outlet.outlet_id)) {
      skipped.push({ date: r.date, outlet: r.outletName, reason: 'duplikat — baris (date, outlet) sudah ada' });
      continue;
    }
    const brand = brands.find((b) => b.brand_id === outlet.brand_id);
    const settle = computeSettlement(r.settlement, r.netSales);
    inserted.push({
      pos_id: nextSequentialIdSync('POS'),
      date: r.date,
      brand_id: outlet.brand_id,
      brand_name: brand?.brand_name ?? r.brandName,
      outlet_id: outlet.outlet_id,
      outlet_name: outlet.outlet_name,
      gross_sales: String(r.grossSales),
      net_sales: String(r.netSales),
      discount: String(r.discount),
      refund: String(r.refund),
      void: String(r.voidAmount),
      tax: String(r.tax),
      service_charge: String(r.serviceCharge),
      settle_cash: String(r.settlement.cash),
      settle_qris: String(r.settlement.qris),
      settle_card: String(r.settlement.card),
      settle_transfer: String(r.settlement.transfer),
      settle_marketplace: String(r.settlement.marketplace),
      total_settlement: String(settle.totalSettlement),
      settlement_difference: String(settle.settlementDifference),
      transaction_count: String(r.transactionCount),
      aov: String(r.aov),
      cashier: '',
      shift: r.shift ?? '',
      payment_method: '',
      source: 'moka',
      source_ref: '',
      notes: '',
      source_module: 'pos',
      source_transaction_id: '',
      payment_source: '',
      linked_expense_id: '',
      linked_supplier_invoice_id: '',
      linked_petty_cash_id: '',
      created_by: s.userId,
      created_at: t,
      updated_at: t
    });
  }

  if (inserted.length > 0) await appendRows(TABS.posDaily, inserted);
  await logAudit({
    module: 'finance', action: 'import', recordType: 'fin_pos_daily',
    recordId: `import-${t}`,
    afterValue: JSON.stringify({ inserted: inserted.length, skipped: skipped.length, dropped: parsed.errors.length }),
    userId: s.userId
  }).catch(() => null);

  return ok({
    inserted: inserted.length,
    skipped,
    errors: parsed.errors,
    variance_report: parsed.variance_report,
    source: sheetTitle ? 'google_sheet' : 'csv',
    sheet_title: sheetTitle
  }, inserted.length > 0 ? 201 : 200);
});
