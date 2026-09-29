/**
 * POST /api/moka/import — pull sales from the Moka API into fin_pos_daily
 * using the SAME aggregation/dedup pipeline as CSV import. Accepts
 * { from, to, dry_run?, outlet_ids? }. Requires import:pos role.
 *
 * This is the OPTIONAL companion to CSV/Google-Sheet import (the primary
 * path, untouched by this feature).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { isMokaConfigured, normalizeMokaSales, getActiveBinding, type MokaBinding } from '@/lib/moka-auth';
import { computeSettlement } from '@/lib/settlement';

const MOKA_API_BASE = 'https://api.mokapos.com';
const MAX_DAYS = 62;

function outletIdsFromBinding(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    if (Array.isArray((parsed as { outlet_ids?: unknown[] }).outlet_ids)) {
      return ((parsed as { outlet_ids?: unknown[] }).outlet_ids ?? []).map((x) => String(x));
    }
  } catch {
    /* fall through: raw is a comma-separated list */
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Fetch paid transactions per outlet, one page per outlet for now —
 * Moka's pagination shape is not publicly documented, so we stay defensive
 * and extend here once confirmed against a live merchant.
 */
async function fetchAllTransactions(
  binding: Pick<MokaBinding, 'access_token' | 'outlet_ids'>,
  from: string,
  to: string,
  filterIds: string[],
): Promise<Record<string, unknown>[]> {
  const configured = outletIdsFromBinding(binding.outlet_ids);
  const ids = filterIds.length > 0 ? filterIds : configured;
  if (ids.length === 0) return [];

  const fromIso = `${from}T00:00:00+07:00`;
  const toIso = `${to}T23:59:59+07:00`;
  const all: Record<string, unknown>[] = [];

  for (const outletId of ids) {
    const url = `${MOKA_API_BASE}/v1/outlets/${encodeURIComponent(outletId)}/transactions`
      + `?page=1&per_page=100`
      + `&start_time=${encodeURIComponent(fromIso)}&end_time=${encodeURIComponent(toIso)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${binding.access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) continue;
    const body = (await res.json().catch(() => ({}))) as {
      data?: { transactions?: Record<string, unknown>[] } | Record<string, unknown>[];
    };
    const list = Array.isArray(body.data)
      ? body.data
      : body.data?.transactions ?? [];
    if (Array.isArray(list)) all.push(...list);
  }
  return all;
}

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');
  if (!isMokaConfigured()) return badRequest('Moka env belum di-set (MOKA_CLIENT_ID / SECRET / REDIRECT_URI)');

  const body = (await req.json().catch(() => ({}))) as {
    from?: string; to?: string; dry_run?: boolean; outlet_ids?: string[];
  };
  const from = (body.from ?? '').trim();
  const to = (body.to ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return badRequest('from & to wajib format YYYY-MM-DD');
  }
  if (to < from) return badRequest('to harus >= from');
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > MAX_DAYS) return badRequest(`Rentang maksimal ${MAX_DAYS} hari`);
  const dryRun = body.dry_run === true;

  const binding = await getActiveBinding();
  if (!binding) return badRequest('Moka belum terhubung — klik "Hubungkan Moka" terlebih dahulu');

  const transactions = await fetchAllTransactions(binding, from, to, body.outlet_ids ?? []);
  const sales = normalizeMokaSales(transactions, '');

  const [outlets, brands, existing] = await Promise.all([
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.posDaily),
  ]);

  const t = nowTimestampWib();
  const inserted: Record<string, string>[] = [];
  const skipped: { date: string; outlet: string; reason: string }[] = [];

  for (const r of sales) {
    const outlet = outlets.find((o) => o.outlet_name.toLowerCase() === r.outletName.toLowerCase());
    if (!outlet) {
      skipped.push({ date: r.date, outlet: r.outletName, reason: 'outlet tidak ditemukan di master_outlet' });
      continue;
    }
    if (existing.some((e) => e.date === r.date && e.outlet_id === outlet.outlet_id)) {
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
      aov: r.transactionCount > 0 ? String(Math.round(r.netSales / r.transactionCount)) : '0',
      cashier: '',
      shift: r.shift ?? '',
      payment_method: '',
      source: 'moka',
      source_ref: 'moka_api',
      notes: '',
      source_module: 'pos',
      source_transaction_id: '',
      payment_source: '',
      linked_expense_id: '',
      linked_supplier_invoice_id: '',
      linked_petty_cash_id: '',
      created_by: s.userId,
      created_at: t,
      updated_at: t,
    });
  }

  if (inserted.length > 0 && !dryRun) await appendRows(TABS.posDaily, inserted);

  await logAudit({
    module: 'finance', action: dryRun ? 'moka-import:dry-run' : 'moka-import', recordType: 'fin_pos_daily',
    recordId: `moka-import-${t}`,
    afterValue: JSON.stringify({
      from, to, transactions: transactions.length,
      inserted: inserted.length, skipped: skipped.length, dryRun,
    }),
    userId: s.userId,
  }).catch(() => null);

  return ok({
    dry_run: dryRun,
    from,
    to,
    transactions_fetched: transactions.length,
    sales_days: sales.length,
    inserted: inserted.length,
    skipped,
    source: 'moka_api',
  }, !dryRun && inserted.length > 0 ? 201 : 200);
});