/**
 * Moka API → Sheets sync engine. Pulls per-outlet sales_summary (v2) +
 * item_sales (v3) for a date, maps outlets via app_settings.moka_outlet_map,
 * and upserts fin_pos_daily / fin_pos_items (source 'moka', integer IDR).
 * Upsert keys: (date, outlet_id) and (date, outlet_id, item_name).
 * Per spec finance/moka-sync: per-outlet isolation, dedup, read-only to Moka.
 */
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { isPostgresMode } from '@/db/postgres';
import {
  type MokaOutletConfig,
  type MokaToken,
  parseOutletKeys,
  mokaDateToIso,
  isoToMokaDate,
  tokenNeedsRefresh,
  refreshAccessToken,
  exchangeAuthorizationCode,
  tryClientCredentials,
  mokaGet
} from './moka-client';
import { nowTimestampWib } from './format';
import { nextSequentialIdSync } from './repo';
import { parseIdrAmount } from './moka-importer';

// ── app_settings K/V helpers ────────────────────────────────────────────

export async function getSetting(key: string): Promise<string> {
  const found = await findRow(TABS.appSettings, 'setting_key', key);
  return found?.row.setting_value ?? '';
}

export async function putSetting(key: string, value: string, updatedBy: string): Promise<void> {
  const found = await findRow(TABS.appSettings, 'setting_key', key);
  const now = nowTimestampWib();
  if (found) {
    await updateRow(TABS.appSettings, found.rowNumber, {
      ...found.row,
      setting_value: value,
      updated_by: updatedBy,
      updated_at: now
    });
  } else {
    await appendRows(TABS.appSettings, [
      { setting_key: key, setting_value: value, description: '', updated_by: updatedBy, updated_at: now }
    ]);
  }
}

export interface StoredToken extends MokaToken {
  needs_reauth?: string;
}

export async function getStoredToken(mokaOutletId: string): Promise<StoredToken | null> {
  const raw = await getSetting(`moka_token:${mokaOutletId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

export async function saveStoredToken(mokaOutletId: string, tok: StoredToken, updatedBy: string): Promise<void> {
  await putSetting(`moka_token:${mokaOutletId}`, JSON.stringify(tok), updatedBy);
}

/** Moka outlet ID → internal OL-NNN. Stored as JSON in app_settings. */
export async function getOutletMap(): Promise<Record<string, string>> {
  const raw = await getSetting('moka_outlet_map');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ── Normalizers (tolerant to field-name drift until the 1.2 spike) ──────

/** Non-negative integer IDR. Delegates strings to parseIdrAmount (Rp/dots/minus conventions). */
export function toIdrInt(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.abs(Math.round(v)) : 0;
  if (typeof v === 'string' && v.trim() === '') return 0;
  return parseIdrAmount(String(v ?? ''));
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

export interface MokaDailySummary {
  date: string; // YYYY-MM-DD
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  void: number;
  tax: number;
  serviceCharge: number;
  transactionCount: number;
  settleCash: number;
  settleQris: number;
  settleCard: number;
  settleTransfer: number;
  settleMarketplace: number;
}

const PAYMENT_ALIASES: Record<keyof Pick<MokaDailySummary, 'settleCash' | 'settleQris' | 'settleCard' | 'settleTransfer' | 'settleMarketplace'>, string[]> = {
  settleCash: ['cash', 'CASH', 'tunai'],
  settleQris: ['qris', 'QRIS', 'qr', 'e_wallet', 'ewallet'],
  settleCard: ['card', 'CARD', 'debit', 'credit', 'kartu'],
  settleTransfer: ['transfer', 'bank_transfer', 'va', 'virtual_account'],
  settleMarketplace: ['marketplace', 'gofood', 'grabfood', 'shopeefood', 'delivery']
};

/**
 * Extract one daily summary from a Moka sales_summary payload. Tolerant:
 * accepts {data:{...}} (ground truth), {data:[...]}, or a bare entry object.
 * Field names per ground truth 2026-09-09: gross_sales, discounts, refunds,
 * gratuities, taxes, number_of_transactions (+ legacy aliases).
 */
export function extractSummary(payload: unknown, dateIso: string): MokaDailySummary | null {
  if (payload === null || payload === undefined) return null;
  const data = (payload as { data?: unknown }).data;
  const entries: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : data && typeof data === 'object'
      ? [data as Record<string, unknown>]
      : payload && typeof payload === 'object'
        ? [payload as Record<string, unknown>]
        : [];
  if (entries.length === 0) return null;
  const entry =
    entries.find((e) => mokaDateToIso(String(pick(e, ['date', 'business_date', 'created_at']) ?? '')) === dateIso) ??
    entries[0];
  const paymentsRaw = (entry.payments ?? entry.payment_methods ?? []) as Record<string, unknown>[];
  const settle = {
    settleCash: 0,
    settleQris: 0,
    settleCard: 0,
    settleTransfer: 0,
    settleMarketplace: 0
  };
  for (const p of Array.isArray(paymentsRaw) ? paymentsRaw : []) {
    const type = String(p.type ?? p.payment_type ?? p.method ?? p.name ?? '').toLowerCase();
    const amount = toIdrInt(p.amount ?? p.total ?? p.value);
    const bucket = (Object.keys(PAYMENT_ALIASES) as (keyof typeof PAYMENT_ALIASES)[]).find((b) =>
      PAYMENT_ALIASES[b].some((a) => type.includes(a.toLowerCase()))
    );
    if (bucket) settle[bucket] += amount;
  }
  const gross = toIdrInt(pick(entry, ['gross_sales', 'total_amount', 'total_collected', 'total_sales']));
  const net = toIdrInt(pick(entry, ['net_sales', 'total_after_discount', 'total_net']));
  const refund = toIdrInt(pick(entry, ['refund', 'total_refund', 'refunds']));
  const discount = toIdrInt(pick(entry, ['discount', 'total_discount', 'discounts']));
  return {
    date: mokaDateToIso(String(pick(entry, ['date', 'business_date', 'created_at']) ?? '')) || dateIso,
    grossSales: gross,
    netSales: net || Math.max(0, gross - discount - refund),
    discount,
    refund,
    void: toIdrInt(pick(entry, ['void', 'void_amount', 'total_void'])),
    tax: toIdrInt(pick(entry, ['tax', 'taxes', 'total_tax'])),
    serviceCharge: toIdrInt(pick(entry, ['service_charge', 'gratuity', 'gratuities', 'total_gratuity'])),
    transactionCount: toIdrInt(pick(entry, ['transaction_count', 'total_transaction', 'num_transactions', 'number_of_transactions'])),
    ...settle
  };
}

export interface MokaItemSale {
  itemName: string;
  sku: string;
  category: string;
  qty: number;
  grossSales: number;
  discount: number;
  refund: number;
  netSales: number;
}

/**
 * Extract item sales rows from a Moka item_sales payload. Ground truth
 * 2026-09-09: {data:{item_sales:[...]}} with fields name, category_name,
 * item_sold, item_refunded (+ legacy shapes tolerated).
 */
export function extractItemSales(payload: unknown, dateIso: string): MokaItemSale[] {
  if (payload === null || payload === undefined) return [];
  const data = (payload as { data?: unknown }).data;
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { item_sales?: unknown })?.item_sales)
      ? ((data as { item_sales: unknown[] }).item_sales)
      : Array.isArray(payload)
        ? payload
        : [];
  const entries = list as Record<string, unknown>[];
  const out: MokaItemSale[] = [];
  for (const e of entries) {
    const rowDate = mokaDateToIso(String(pick(e, ['date', 'business_date', 'created_at']) ?? ''));
    if (dateIso && rowDate && rowDate !== dateIso) continue;
    const itemName = String(pick(e, ['item_name', 'name', 'menu_name']) ?? '').trim();
    if (!itemName) continue;
    const gross = toIdrInt(pick(e, ['gross_sales', 'total_amount', 'total_collected']));
    const discount = toIdrInt(pick(e, ['discount', 'discounts', 'total_discount']));
    const refund = toIdrInt(pick(e, ['refund', 'item_refunded', 'refunds', 'total_refund']));
    out.push({
      itemName,
      sku: String(pick(e, ['sku', 'item_sku', 'code']) ?? ''),
      category: String(pick(e, ['category', 'category_name', 'item_category']) ?? ''),
      qty: toIdrInt(pick(e, ['qty', 'quantity', 'item_sold', 'sold'])),
      grossSales: gross,
      discount,
      refund,
      netSales: toIdrInt(pick(e, ['net_sales', 'total_net'])) || Math.max(0, gross - discount - refund)
    });
  }
  return out;
}

// ── Upsert (idempotent per (date, outlet[, item])) ──────────────────────

export interface DailyRow extends Record<string, string> {
  date: string;
  outlet_id: string;
}

export interface UpsertResult {
  updates: { rowNumber: number; values: Record<string, string> }[];
  appends: Record<string, string>[];
}

/**
 * Merge incoming rows into existing rows by composite key. Existing →
 * updateRow (values refreshed); new → append. Duplicate keys within one
 * batch collapse into the last occurrence (API re-run safety).
 */
export function upsertRows<T extends Record<string, string>>(
  existing: T[],
  rowNumberByKey: Map<string, number>,
  incoming: T[],
  keyOf: (row: T) => string
): UpsertResult {
  const updates: { rowNumber: number; values: Record<string, string> }[] = [];
  const appends: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (let i = incoming.length - 1; i >= 0; i--) {
    const row = incoming[i];
    const key = keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const rn = rowNumberByKey.get(key);
    if (rn) updates.push({ rowNumber: rn, values: row });
    else appends.push(row);
  }
  return { updates: updates.reverse(), appends };
}

// ── Orchestrator ────────────────────────────────────────────────────────

export interface OutletSyncResult {
  outlet_key: string;
  moka_outlet_id: string;
  outlet_id: string | null;
  status: 'ok' | 'error' | 'needs_reauth';
  daily: { written: number; updated: number };
  items: { written: number; updated: number };
  error?: string;
}

export interface MokaSyncResult {
  date: string;
  outlets: OutletSyncResult[];
}

async function ensureToken(cfg: MokaOutletConfig, actor: string): Promise<string> {
  const stored = await getStoredToken(cfg.mokaOutletId);
  if (stored?.needs_reauth) throw new Error('REAUTH_REQUIRED');
  if (stored && !tokenNeedsRefresh(stored)) return stored.access_token;
  if (stored?.refresh_token) {
    try {
      const fresh = await refreshAccessToken(cfg, stored.refresh_token);
      await saveStoredToken(cfg.mokaOutletId, fresh, actor);
      return fresh.access_token;
    } catch {
      // refresh rejected → fall through to client_credentials issuance
    }
  }
  // Machine grant (ground truth 2026-09-09: works when the app has the
  // "Laporan Merchant" scope enabled; token carries scope=report).
  const fresh = await tryClientCredentials(cfg);
  await saveStoredToken(cfg.mokaOutletId, fresh, actor);
  return fresh.access_token;
}

/**
 * One-time setup (spec: alur otorisasi sekali-jalankan). Two modes:
 *  - code given → exchange authorization_code via App Market callback
 *  - no code → probe client_credentials (works only if the merchant supports it)
 * Stores tokens per moka_outlet_id in app_settings.
 */
export async function authorizeMokaOutlet(opts: {
  outletKey: string;
  code?: string;
  redirectUri?: string;
  actor: string;
}): Promise<{ ok: boolean; mode?: string; error?: string }> {
  const { configured } = parseOutletKeys();
  const cfg = configured.find((c) => c.key === opts.outletKey);
  if (!cfg) return { ok: false, error: `outlet '${opts.outletKey}' tidak ditemukan atau konfigurasi env tidak lengkap` };
  try {
    const tok = opts.code
      ? await exchangeAuthorizationCode(cfg, opts.code, opts.redirectUri)
      : await tryClientCredentials(cfg);
    await saveStoredToken(cfg.mokaOutletId, tok, opts.actor);
    return { ok: true, mode: opts.code ? 'authorization_code' : 'client_credentials' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Best-effort parse of GET /v1/quotas — remaining count, null when unclear. */
export function parseQuotaRemaining(payload: unknown): number | null {
  const candidates: unknown[] = [payload, (payload as { data?: unknown })?.data];
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    for (const k of ['remaining', 'remaining_quota', 'quota_remaining', 'remaining_call', 'left']) {
      const v = obj[k];
      if (v !== undefined && v !== null && Number.isFinite(Number(v))) return Number(v);
    }
  }
  return null;
}

/** Pre-batch quota gate: stop the outlet with a clear error when Moka reports 0 remaining. */
async function checkQuota(token: string): Promise<void> {
  try {
    const payload = await mokaGet(token, '/v1/quotas', { resource: 'report' });
    const remaining = parseQuotaRemaining(payload);
    if (remaining === 0) throw new Error('QUOTA_EXHAUSTED');
  } catch (e) {
    if (e instanceof Error && e.message === 'QUOTA_EXHAUSTED') throw e;
    // Quota endpoint unclear/unavailable → proceed (reports still validated per-call).
  }
}

function fetchReport(token: string, version: string, mokaOutletId: string, dateIso: string): Promise<unknown> {
  return mokaGet(token, `/v${version}/outlets/${mokaOutletId}/reports/${version === '3' ? 'item_sales' : 'sales_summary'}`, {
    start: isoToMokaDate(dateIso),
    end: isoToMokaDate(dateIso)
  });
}

/**
 * Run a full sync for one date across all configured outlets (or the given
 * subset). Per spec: one outlet failing must not stop the others, and the
 * result summarizes per outlet.
 */
export async function runMokaSync(opts: { date: string; outletKey?: string; actor: string }): Promise<MokaSyncResult> {
  const { configured, incomplete } = parseOutletKeys();
  const results: OutletSyncResult[] = [];
  let outletMap = await getOutletMap();
  // Bootstrap: MOKA_OUTLET_MAP env (JSON) seeds app_settings.moka_outlet_map
  // once, when the stored map is still empty (deploy convenience + local test).
  const envMap = process.env.MOKA_OUTLET_MAP?.trim();
  if (envMap && Object.keys(outletMap).length === 0) {
    try {
      const parsed = JSON.parse(envMap) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        await putSetting('moka_outlet_map', JSON.stringify(parsed), opts.actor);
        outletMap = parsed;
      }
    } catch {
      // invalid JSON → mapping stays empty; unmappeoutlet errors stay explicit
    }
  }
  const date = opts.date;

  for (const { key, missing } of incomplete) {
    if (opts.outletKey && opts.outletKey !== key) continue;
    results.push({
      outlet_key: key,
      moka_outlet_id: '',
      outlet_id: null,
      status: 'error',
      daily: { written: 0, updated: 0 },
      items: { written: 0, updated: 0 },
      error: `konfigurasi tidak lengkap: ${missing.join(', ')}`
    });
  }

  for (const cfg of configured) {
    if (opts.outletKey && opts.outletKey !== cfg.key) continue;
    const r: OutletSyncResult = {
      outlet_key: cfg.key,
      moka_outlet_id: cfg.mokaOutletId,
      outlet_id: outletMap[cfg.mokaOutletId] ?? null,
      status: 'ok',
      daily: { written: 0, updated: 0 },
      items: { written: 0, updated: 0 }
    };
    results.push(r);
    try {
      if (!r.outlet_id) throw new Error(`outlet Moka ${cfg.mokaOutletId} belum dipetakan di app_settings.moka_outlet_map`);

      const token = await ensureToken(cfg, opts.actor);
      await checkQuota(token);

      const [summaryPayload, itemsPayload] = await Promise.all([
        fetchReport(token, '2', cfg.mokaOutletId, date),
        fetchReport(token, '3', cfg.mokaOutletId, date)
      ]);
      const summary = extractSummary(summaryPayload, date);
      const items = extractItemSales(itemsPayload, date);

      const [outlets, brands, existingDaily, existingItems] = await Promise.all([
        readTab<Record<string, string>>(TABS.outlets),
        readTab<Record<string, string>>(TABS.brands),
        readTab<Record<string, string>>(TABS.posDaily),
        readTab<Record<string, string>>(TABS.posItems)
      ]);
      const outlet = outlets.find((o) => o.outlet_id === r.outlet_id);
      const brandId = outlet?.brand_id ?? '';
      const brandName = brands.find((b) => b.brand_id === brandId)?.brand_name ?? outlet?.outlet_name ?? '';
      const t = nowTimestampWib();
      // PG backend: rowNumber = real __rownum (Sheets-style index+2 breaks:
      // PG __rownum starts at 1 → off-by-one update hits the neighbour row
      // and violates the PK on re-sync). Sheets/mock: no __rownum field →
      // physical row = index+2 (row 1 is the header).
      const pgMode = isPostgresMode();

      if (summary) {
        const row: Record<string, string> = {
          pos_id: nextSequentialIdSync('POS'),
          date,
          brand_id: brandId,
          brand_name: brandName,
          outlet_id: r.outlet_id!,
          outlet_name: outlet?.outlet_name ?? '',
          gross_sales: String(summary.grossSales),
          net_sales: String(summary.netSales),
          discount: String(summary.discount),
          refund: String(summary.refund),
          void: String(summary.void),
          tax: String(summary.tax),
          service_charge: String(summary.serviceCharge),
          settle_cash: String(summary.settleCash),
          settle_qris: String(summary.settleQris),
          settle_card: String(summary.settleCard),
          settle_transfer: String(summary.settleTransfer),
          settle_marketplace: String(summary.settleMarketplace),
          total_settlement: String(
            summary.settleCash + summary.settleQris + summary.settleCard + summary.settleTransfer + summary.settleMarketplace
          ),
          settlement_difference: '0',
          transaction_count: String(summary.transactionCount),
          aov: summary.transactionCount > 0 ? String(Math.round(summary.netSales / summary.transactionCount)) : '0',
          cashier: '',
          shift: '',
          payment_method: '',
          source: 'moka',
          source_ref: `moka:${cfg.mokaOutletId}`,
          notes: '',
          source_module: 'pos',
          source_transaction_id: '',
          payment_source: '',
          linked_expense_id: '',
          linked_supplier_invoice_id: '',
          linked_petty_cash_id: '',
          created_by: opts.actor,
          created_at: t,
          updated_at: t
        };
        const dailyByKey = new Map<string, number>();
        existingDaily.forEach((row, i) => {
          if (row.date && row.outlet_id) {
            dailyByKey.set(
              `${row.date}|${row.outlet_id}`,
              pgMode ? Number(row.__rownum) : i + 2
            );
          }
        });
        // preserve original pos_id/created_at on update
        const upsert = upsertRows(existingDaily, dailyByKey, [row], (rw) => `${rw.date}|${rw.outlet_id}`);
        for (const u of upsert.updates) {
          const prev = existingDaily[pgMode ? existingDaily.findIndex((x) => Number(x.__rownum) === u.rowNumber) : u.rowNumber - 2];
          u.values.pos_id = prev?.pos_id || u.values.pos_id;
          u.values.created_at = prev?.created_at || u.values.created_at;
        }
        for (const u of upsert.updates) await updateRow(TABS.posDaily, u.rowNumber, u.values);
        if (upsert.appends.length > 0) await appendRows(TABS.posDaily, upsert.appends);
        r.daily = { written: upsert.appends.length, updated: upsert.updates.length };
      }

      if (items.length > 0) {
        const itemRows = items.map((it) => ({
          pos_item_id: nextSequentialIdSync('POSI'),
          date,
          brand_id: brandId,
          brand_name: brandName,
          outlet_id: r.outlet_id!,
          outlet_name: outlet?.outlet_name ?? '',
          item_name: it.itemName,
          sku: it.sku,
          category: it.category,
          qty: String(it.qty),
          gross_sales: String(it.grossSales),
          discount: String(it.discount),
          refund: String(it.refund),
          net_sales: String(it.netSales),
          source: 'moka',
          created_at: t
        }));
        const itemsByKey = new Map<string, number>();
        existingItems.forEach((row, i) => {
          if (row.date && row.outlet_id && row.item_name) {
            itemsByKey.set(
              `${row.date}|${row.outlet_id}|${row.item_name}`,
              pgMode ? Number(row.__rownum) : i + 2
            );
          }
        });
        const upsert = upsertRows(existingItems, itemsByKey, itemRows, (rw) => `${rw.date}|${rw.outlet_id}|${rw.item_name}`);
        for (const u of upsert.updates) {
          const prev = existingItems[pgMode ? existingItems.findIndex((x) => Number(x.__rownum) === u.rowNumber) : u.rowNumber - 2];
          u.values.pos_item_id = prev?.pos_item_id || u.values.pos_item_id;
          u.values.created_at = prev?.created_at || u.values.created_at;
        }
        for (const u of upsert.updates) await updateRow(TABS.posItems, u.rowNumber, u.values);
        if (upsert.appends.length > 0) await appendRows(TABS.posItems, upsert.appends);
        r.items = { written: upsert.appends.length, updated: upsert.updates.length };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      r.status = msg === 'REAUTH_REQUIRED' ? 'needs_reauth' : 'error';
      r.error = msg === 'REAUTH_REQUIRED' ? 'perlu otorisasi ulang Moka (authorize sekali via App Market)' : msg;
    }
  }

  return { date, outlets: results };
}