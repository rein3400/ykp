/**
 * Moka POS OAuth helper (Finance).
 *
 * Flow (authorization-code grant per connect.mokapos.com sample):
 *   1. GET /api/moka/authorize          → 302 to Moka login+consent
 *   2. Moka redirects to /api/moka/callback?code=&state=
 *   3. Callback exchanges code → access/refresh token, stores binding in
 *      finance_moka_auth (one row per merchant), redirects back to POS page.
 *   4. POST /api/moka/import            → pull sales from Moka API into
 *      fin_pos_daily through the SAME aggregation/dedup pipeline as CSV.
 *
 * Env:
 *   MOKA_CLIENT_ID      (= "Application ID" from the dev dashboard)
 *   MOKA_CLIENT_SECRET  (= "Secret" — rotate if ever shared on a screen share)
 *   MOKA_REDIRECT_URI   (must match a registered Redirect URL exactly)
 *   MOKA_ENV            optional: "sandbox" | "production" (default production)
 *
 * Import-first doctrine: CSV / Google Sheet import remains the primary path;
 * the M API is an optional convenience and never mutates anything beyond
 * fin_pos_daily / fin_pos_items rows.
 */

export const MOKA_OPEN_API_AUTHORIZE = 'https://www.mokapos.com/open_api/authorize';
export const MOKA_TOKEN_URL = 'https://api.mokapos.com/oauth/token';

/** Moka scopes for read-only reporting; add more only when a feature needs it. */
export const MOKA_SCOPES = [
  'open_api_sales',
  'open_api_outlet',
  'open_api_item',
  'open_api_payment',
].join(' ');

export interface MokaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** True when every Moka env var is present (connection feature enabled). */
export function isMokaConfigured(): boolean {
  const c = mokaConfig();
  return c !== null;
}

export function mokaConfig(): MokaConfig | null {
  const clientId = (process.env.MOKA_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.MOKA_CLIENT_SECRET ?? '').trim();
  const redirectUri = (process.env.MOKA_REDIRECT_URI ?? '').trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

/**
 * One-time CSRF state store — in-memory keyed by state, 10-minute TTL.
 * Serverless caveat: on Vercel each instance holds its own map, so the
 * callback must land on the same instance (normal for the OAuth round trip);
 * on a long-lived host (Railway/PM2) it behaves like a classic store.
 */
const pendingStates = new Map<string, { createdAt: number }>();
const STATE_TTL_MS = 10 * 60_000;

export function createState(): string {
  const state = Array.from({ length: 24 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  pendingStates.set(state, { createdAt: Date.now() });
  for (const [k, v] of pendingStates) if (Date.now() - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  return state;
}

export function consumeState(state: string): boolean {
  const entry = pendingStates.get(state);
  if (!entry) return false;
  pendingStates.delete(state);
  return Date.now() - entry.createdAt <= STATE_TTL_MS;
}

export interface MokaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface MokaTokenResponse {
  status: number;
  body: MokaToken;
}

/** Exchange an authorization code for the token pair. */
export async function exchangeCode(code: string, cfg: MokaConfig): Promise<MokaTokenResponse> {
  const res = await fetch(MOKA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      code,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as MokaToken;
  return { status: res.status, body };
}

/** Moka sales row as normalized by the importer pipeline. */
export interface MokaSaleRow {
  date: string;
  outletName: string;
  brandName: string;
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  voidAmount: number;
  tax: number;
  serviceCharge: number;
  settlement: { cash: number; qris: number; card: number; transfer: number; marketplace: number };
  transactionCount: number;
  shift?: string;
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function bucketOf(rawType: string | undefined): keyof MokaSaleRow['settlement'] | null {
  const t = (rawType ?? '').toLowerCase();
  if (/cash|tunai/.test(t)) return 'cash';
  if (/qris|ewallet|e_wallet|ovo|gopay|dana|shopeepay/.test(t)) return 'qris';
  if (/card|debit|credit|kartu/.test(t)) return 'card';
  if (/transfer/.test(t)) return 'transfer';
  if (/marketplace|gofood|grabfood|shopeefood|online/.test(t)) return 'marketplace';
  return null;
}

function ymd(iso: string): string {
  return (iso ?? '').slice(0, 10);
}

/**
 * Normalize raw Moka invoices (or checkouts) into the same shape the CSV
 * importer produces, so the downstream aggregation/dedup pipeline is shared.
 */
export function normalizeMokaSales(invoices: unknown, fallbackBrand = ''): MokaSaleRow[] {
  const list = Array.isArray(invoices) ? invoices : ((invoices as { invoices?: unknown[]; data?: unknown[] })?.invoices ?? (invoices as { data?: unknown[] })?.data ?? []);
  const byKey = new Map<string, MokaSaleRow>();
  for (const raw of list as Record<string, unknown>[]) {
    const time = String(invoiceTime(raw) ?? '');
    const date = ymd(time);
    if (!date) continue;
    const outletName = outletNameOf(raw);
    if (!outletName) continue;
    const key = `${date}|${outletName}`;
    const row = byKey.get(key) ?? {
      date,
      outletName,
      brandName: brandNameOf(raw) ?? fallbackBrand,
      grossSales: 0,
      netSales: 0,
      discount: 0,
      refund: 0,
      voidAmount: 0,
      tax: 0,
      serviceCharge: 0,
      settlement: { cash: 0, qris: 0, card: 0, transfer: 0, marketplace: 0 },
      transactionCount: 0,
      shift: '',
    };

    const gross = toNum(raw.sub_total) || toNum(raw.gross_sales);
    const dis = toNum(raw.discount_amount) || toNum(raw.discount);
    const refund = toNum(raw.refunds_amount);
    const voidAmt = toNum(raw.void_amount);
    row.grossSales += gross || toNum(raw.total);
    row.discount += dis;
    row.refund += refund;
    row.voidAmount += voidAmt;
    row.tax += toNum(raw.tax_amount);
    row.serviceCharge += toNum(raw.service_amount) || toNum(raw.gratuities_amount);
    row.netSales += gross - dis - refund - voidAmt;
    row.transactionCount += 1;

    for (const p of Array.isArray(raw.payments) ? raw.payments : []) {
      const bucket = bucketOf(String(p?.type ?? p?.payment_type ?? ''));
      if (bucket) row.settlement[bucket] += toNum(p?.amount);
    }

    byKey.set(key, row);
  }
  return [...byKey.values()];
}

function invoiceTime(raw: Record<string, unknown>): string | undefined {
  return (raw.transaction_time ?? raw.created_at ?? undefined) as string | undefined;
}

function outletNameOf(raw: Record<string, unknown>): string {
  const direct = raw.outlet_name;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (raw.outlet && typeof raw.outlet === 'object') {
    const name = (raw.outlet as Record<string, unknown>).name;
    if (typeof name === 'string') return name;
  }
  if (typeof raw.outlet === 'string') return raw.outlet;
  return '';
}

function brandNameOf(raw: Record<string, unknown>): string | undefined {
  if (typeof raw.brand_name === 'string' && raw.brand_name.trim()) return raw.brand_name;
  return undefined;
}

// ── Binding store (finance_moka_auth) ────────────────────────────────

export interface MokaBinding {
  id: string;
  merchant_id: string;
  merchant_name: string;
  business_id: string;
  outlet_ids: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  connected_by: string;
  connected_at: string;
  disconnected_at: string;
  updated_at: string;
}

function serialize(b: MokaBinding): Record<string, string> {
  return { ...b };
}

function deserialize(r: Record<string, string>): MokaBinding {
  return {
    id: r.id ?? '',
    merchant_id: r.merchant_id ?? '',
    merchant_name: r.merchant_name ?? '',
    business_id: r.business_id ?? '',
    outlet_ids: r.outlet_ids ?? '',
    access_token: r.access_token ?? '',
    refresh_token: r.refresh_token ?? '',
    expires_at: r.expires_at ?? '',
    scope: r.scope ?? '',
    connected_by: r.connected_by ?? '',
    connected_at: r.connected_at ?? '',
    disconnected_at: r.disconnected_at ?? '',
    updated_at: r.updated_at ?? '',
  };
}

/** Persist one merchant binding (upsert by merchant_id among active rows). */
export async function saveBinding(binding: MokaBinding): Promise<void> {
  const { readTab, appendRows, updateRow, findRow, TABS } = await import('@/db/sheets');
  const rows = await readTab<Record<string, string>>(TABS.mokaAuth);
  const existing = rows.find((r) => r.merchant_id === binding.merchant_id && !(r.disconnected_at ?? '').trim());
  if (existing) {
    const found = await findRow(TABS.mokaAuth, 'id', existing.id);
    if (found) {
      await updateRow(TABS.mokaAuth, found.rowNumber, { ...found.row, ...serialize(binding) });
      return;
    }
  }
  await appendRows(TABS.mokaAuth, [serialize(binding)]);
}

/** Most recent active binding (disconnected_at empty), or null. */
export async function getActiveBinding(): Promise<MokaBinding | null> {
  const { readTab, TABS } = await import('@/db/sheets');
  const rows = await readTab<Record<string, string>>(TABS.mokaAuth);
  const active = rows
    .filter((r) => r.access_token && !(r.disconnected_at ?? '').trim())
    .sort((a, b) => (b.connected_at ?? '').localeCompare(a.connected_at ?? ''));
  return active.length > 0 ? deserialize(active[0]) : null;
}

/** Soft-disconnect every active binding (rows kept for audit). */
export async function disconnectAll(): Promise<number> {
  const { readTab, updateRow, findRow, TABS } = await import('@/db/sheets');
  const rows = await readTab<Record<string, string>>(TABS.mokaAuth);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let n = 0;
  for (const r of rows) {
    if (r.access_token && !(r.disconnected_at ?? '').trim()) {
      const found = await findRow(TABS.mokaAuth, 'id', r.id);
      if (found) {
        await updateRow(TABS.mokaAuth, found.rowNumber, { ...found.row, disconnected_at: now, updated_at: now });
        n++;
      }
    }
  }
  return n;
}