/**
 * Google Sheets DB for YKP Investor V1.
 * Spreadsheet: YKP_INVESTOR_V1 (own data) + read-only cross-read of YKP_FINANCE_V1 (revenue/profit).
 */
import { google, type sheets_v4 } from 'googleapis';
import { isMockMode, mockReadTab, mockAppendRows, mockUpdateRow, mockFindRow } from './mock-store';
import { todayWib } from '@/lib/format';

/** YYYY-MM-DD for N days before today (Asia/Jakarta), used for growth baseline. */
function addDaysWib(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let cached: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error('Google Sheets not configured.');
  }
  const auth = new google.auth.JWT({ email, key: privateKey.replace(/\\n/g, '\n'), scopes: SCOPES });
  cached = google.sheets({ version: 'v4', auth });
  return cached;
}

export function getSpreadsheetId(): string {
  const id = process.env.YKP_INVESTOR_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_INVESTOR_SPREADSHEET_ID not set');
  return id;
}

export function getFinanceSpreadsheetId(): string {
  const id = process.env.YKP_FINANCE_SPREADSHEET_ID;
  if (!id) throw new Error('YKP_FINANCE_SPREADSHEET_ID not set');
  return id;
}

export const TABS = {
  investors: 'master_investor',
  capital: 'investor_capital',
  shareholding: 'investor_shareholding',
  dividend: 'investor_dividend',
  dashboard: 'investor_dashboard',
  summary: 'investor_daily_summary',
  // Namespaced — must NOT share warehouse `users` / `audit_log` tabs
  // (shared spreadsheet multi-app; header overwrite broke login active_status).
  users: 'investor_users',
  auditLog: 'investor_audit_log',
  hermezAlerts: 'investor_hermes_alert_log',
  telegramDeliveryLog: 'telegram_delivery_log',
  // ── Photo/document attachments (Drive-backed) + MOU + share history ──
  attachments: 'investor_attachments',
  documents: 'investor_documents',
  shareHistory: 'investor_share_history'
} as const;
export type TabName = (typeof TABS)[keyof typeof TABS];

export const TAB_HEADERS: Record<TabName, string[]> = {
  [TABS.investors]: [
    'investor_id', 'investor_name', 'email', 'phone', 'company',
    'investor_type', 'join_date', 'status', 'note', 'created_at'
  ],
  [TABS.capital]: [
    'capital_id', 'investor_id', 'date', 'type', 'amount', 'method',
    'reference', 'note', 'created_by', 'created_at'
  ],
  [TABS.shareholding]: [
    'share_id', 'investor_id', 'brand_id', 'brand_name', 'share_pct',
    'share_value', 'valuation_date', 'last_updated'
  ],
  [TABS.dividend]: [
    'dividend_id', 'investor_id', 'period', 'amount', 'status',
    'declared_at', 'paid_at', 'reference', 'created_at'
  ],
  [TABS.dashboard]: [
    'period', 'total_revenue', 'total_profit', 'total_capital',
    'active_investors', 'dividend_declared', 'dividend_paid', 'created_at'
  ],
  [TABS.summary]: [
    'summary_id', 'date', 'total_revenue', 'total_profit', 'total_capital',
    'active_investors', 'dividend_declared', 'growth_pct', 'created_at'
  ],
  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role',
    'investor_id', 'department', 'telegram_id', 'active_status', 'created_at', 'last_login_at'
  ],
  [TABS.auditLog]: [
    'audit_id', 'timestamp', 'actor_user_id', 'actor_role', 'action',
    'entity', 'entity_id', 'before_value', 'after_value', 'reason', 'ip_address'
  ],
  [TABS.hermezAlerts]: [
    'alert_id', 'date', 'source_app', 'alert_type', 'severity', 'message',
    'status', 'created_at', 'resolved_at'
  ],
  [TABS.telegramDeliveryLog]: [
    'delivery_id', 'source_module', 'source_reference_id', 'message_type',
    'recipient', 'message_id', 'status', 'retry_count', 'sent_at',
    'error_message', 'created_at'
  ],
  [TABS.attachments]: [
    'attachment_id', 'entity_type', 'entity_id', 'file_id', 'file_name',
    'mime_type', 'size_bytes', 'uploaded_by', 'created_at'
  ],
  // MOU & legal docs per investor (versioned; expiry drives lapse warnings)
  [TABS.documents]: [
    'doc_id', 'investor_id', 'doc_type', 'attachment_id', 'signed_date',
    'expiry_date', 'note', 'created_at'
  ],
  // Profit-share percentage per (investor, brand) over time; the row with
  // the latest effective_date <= period end is authoritative for dividends.
  [TABS.shareHistory]: [
    'hist_id', 'investor_id', 'brand_id', 'share_pct', 'effective_date',
    'created_by', 'created_at'
  ]
};

export async function readTab<T = Record<string, string>>(tab: TabName): Promise<T[]> {
  if (isMockMode()) return mockReadTab(tab) as T[];
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${quoteTab(tab)}!A1:${lastCol}1000`
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headerRow = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => { obj[h] = (row[i] as string) ?? ''; });
    return obj as T;
  });
}

/**
 * Best-effort readTab that never throws — used by pages/routes that join many
 * tabs where one optional tab (e.g. `investor_documents`) may not yet exist
 * on the prod spreadsheet and Google Sheets returns a 400 "Unable to parse
 * range". Returns [] on any error so the rest of the page still renders.
 */
export async function readTabSafe<T = Record<string, string>>(tab: TabName): Promise<T[]> {
  try {
    return await readTab<T>(tab);
  } catch {
    return [] as T[];
  }
}

/** Cross-spreadsheet read for Finance fin_daily_summary. */
export async function readFinanceTab<T = Record<string, string>>(tabName: string): Promise<T[]> {
  // In mock mode there is no shared finance spreadsheet. Read the finance
  // app's PUBLIC summary HTTP API instead (the same no-write-back pattern the
  // owner app uses). Works for fin_daily_summary; other tabs have no public
  // endpoint and return empty.
  if (isMockMode()) {
    if (tabName !== 'fin_daily_summary') return [] as T[];
    const base = process.env.YKP_FINANCE_URL ?? 'http://localhost:3003';
    const dates = [todayWib(), addDaysWib(-1)];
    const all: Record<string, string>[] = [];
    for (const d of dates) {
      try {
        const res = await fetch(`${base}/api/finance/summary?date=${encodeURIComponent(d)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) continue;
        const j = (await res.json()) as { data?: { items?: Record<string, string>[] } };
        all.push(...(j.data?.items ?? []));
      } catch { /* finance unreachable — best-effort, yields fewer rows */ }
    }
    return all as T[];
  }
  const sheets = getSheetsClient();
  const sid = getFinanceSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${quoteTab(tabName)}!A1:Z1000`
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headerRow = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => { obj[h] = (row[i] as string) ?? ''; });
    return obj as T;
  });
}

export async function appendRows(tab: TabName, rows: Record<string, string>[]): Promise<number> {
  if (rows.length === 0) return -1;
  if (isMockMode()) return mockAppendRows(tab, rows);
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const values = rows.map((r) => headers.map((h) => r[h] ?? ''));
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: sid, range: `${quoteTab(tab)}!A1`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
  const m = (res.data.updates?.updatedRange ?? '').match(/![A-Z]+(\d+):/);
  return m && m[1] ? Number(m[1]) : -1;
}

export async function updateRow(tab: TabName, rowNumber: number, values: Record<string, string>): Promise<void> {
  if (isMockMode()) { mockUpdateRow(tab, rowNumber, values); return; }
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  const arr = headers.map((h) => values[h] ?? '');
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid, range: `${quoteTab(tab)}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: 'USER_ENTERED', requestBody: { values: [arr] }
  });
}

export async function findRow(tab: TabName, keyCol: string, value: string): Promise<{ rowNumber: number; row: Record<string, string> } | null> {
  if (isMockMode()) return mockFindRow(tab, keyCol, value);
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const headers = TAB_HEADERS[tab];
  const colIdx = headers.indexOf(keyCol);
  if (colIdx < 0) throw new Error(`Column ${keyCol} not in ${tab}`);
  const lastCol = columnLetter(headers.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${quoteTab(tab)}!A1:${lastCol}`
  });
  const rows = res.data.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.[colIdx] === value) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (rows[i]?.[idx] ?? '') as string; });
      return { rowNumber: i + 1, row: obj };
    }
  }
  return null;
}

function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

export function columnLetter(colIdx1Based: number): string {
  let n = colIdx1Based, s = '';
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}