/**
 * Moka item-sales CSV import → fin_pos_items. Parses via lib/moka-items-importer
 * (pure), resolves outlet by name, skips duplicates per (date, outlet, item),
 * returns the variance report.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { parseMokaItemsCsv } from '@/lib/moka-items-importer';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { csv?: string };
  const csv = (body.csv ?? '').trim();
  if (!csv) return badRequest('csv is required');

  const parsed = parseMokaItemsCsv(csv);
  const [outlets, brands, existing] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.posItems)
  ]);

  const t = nowTimestampWib();
  const inserted: Record<string, string>[] = [];
  const skipped: { date: string; outlet: string; item: string; reason: string }[] = [];

  for (const r of parsed.rows) {
    const outlet = outlets.find((o) => o.outlet_name.toLowerCase() === r.outletName.toLowerCase());
    if (!outlet) {
      skipped.push({ date: r.date, outlet: r.outletName, item: r.itemName, reason: 'outlet tidak ditemukan di master_outlet' });
      continue;
    }
    const dup = (e: Record<string, string>) =>
      e.date === r.date && e.outlet_id === outlet.outlet_id && e.item_name === r.itemName;
    if (existing.some(dup) || inserted.some(dup)) {
      skipped.push({ date: r.date, outlet: r.outletName, item: r.itemName, reason: 'duplikat — baris (date, outlet, item) sudah ada' });
      continue;
    }
    const brand = brands.find((b) => b.brand_id === outlet.brand_id);
    inserted.push({
      pos_item_id: nextSequentialIdSync('PSI'),
      date: r.date,
      brand_id: outlet.brand_id,
      brand_name: brand?.brand_name ?? r.brandName,
      outlet_id: outlet.outlet_id,
      outlet_name: outlet.outlet_name,
      item_name: r.itemName,
      sku: r.sku,
      category: r.category,
      qty: String(r.qty),
      gross_sales: String(r.grossSales),
      discount: String(r.discount),
      refund: String(r.refund),
      net_sales: String(r.netSales),
      source: 'moka_items_import',
      created_at: t
    });
  }

  if (inserted.length > 0) await appendRows(TABS.posItems, inserted);
  await logAudit({
    module: 'finance',
    action: 'import',
    recordType: 'pos_items',
    recordId: `moka-items-${t}`,
    afterValue: JSON.stringify({ inserted: inserted.length, skipped: skipped.length }),
    userId: s.userId
  }).catch(() => null);

  return ok({
    inserted: inserted.length,
    skipped,
    errors: parsed.errors,
    variance_report: parsed.variance_report
  });
});
