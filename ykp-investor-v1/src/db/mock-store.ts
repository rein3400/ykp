/**
 * In-memory mock DB for local demo / Playwright.
 * Self-contained (no import from sheets.ts) to avoid circular deps.
 */
import { createHash } from 'crypto';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

const TAB = {
  investors: 'master_investor',
  capital: 'investor_capital',
  shareholding: 'investor_shareholding',
  dividend: 'investor_dividend',
  dashboard: 'investor_dashboard',
  summary: 'investor_daily_summary',
  users: 'investor_users',
  auditLog: 'investor_audit_log',
  hermezAlerts: 'investor_hermes_alert_log'
} as const;

function seed(): Record<string, Record<string, string>[]> {
  const pw = createHash('sha256').update('owner123').digest('hex');
  return {
    [TAB.investors]: [
      {
        investor_id: 'INV-001',
        investor_name: 'YKP Owner',
        email: 'owner@ykp.id',
        phone: '0812',
        company: 'PT YKP',
        investor_type: 'founder',
        join_date: '2024-01-01',
        status: 'active',
        note: '',
        created_at: now()
      }
    ],
    [TAB.capital]: [],
    [TAB.shareholding]: [
      {
        share_id: 'SHR-001',
        investor_id: 'INV-001',
        brand_id: 'BR-001',
        brand_name: 'Funkydak',
        share_pct: '100',
        share_value: '5000000000',
        valuation_date: '2026-01-01',
        last_updated: now()
      }
    ],
    [TAB.dividend]: [],
    [TAB.dashboard]: [],
    [TAB.summary]: [],
    [TAB.users]: [
      {
        user_id: 'USR-001',
        username: 'owner',
        password_hash: pw,
        role: 'owner',
        investor_id: '',
        active_status: 'active',
        created_at: now(),
        last_login_at: ''
      }
    ],
    [TAB.auditLog]: [],
    [TAB.hermezAlerts]: []
  };
}

let store: Record<string, Record<string, string>[]> | null = null;
function getStore() {
  if (!store) store = seed();
  return store;
}

export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DB === 'true') return true;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return true;
  if (!process.env.YKP_INVESTOR_SPREADSHEET_ID) return true;
  return false;
}

export function mockReadTab(tab: string): Record<string, string>[] {
  return [...(getStore()[tab] ?? [])];
}

export function mockAppendRows(tab: string, rows: Record<string, string>[]): number {
  const s = getStore();
  if (!s[tab]) s[tab] = [];
  const start = s[tab].length + 2;
  s[tab].push(...rows.map((r) => ({ ...r })));
  return start;
}

export function mockUpdateRow(tab: string, rowNumber: number, values: Record<string, string>): void {
  const s = getStore();
  const idx = rowNumber - 2;
  if (idx < 0 || !s[tab]?.[idx]) throw new Error(`mock row ${rowNumber} not found in ${tab}`);
  s[tab][idx] = { ...s[tab][idx], ...values };
}

export function mockFindRow(
  tab: string,
  keyCol: string,
  value: string
): { rowNumber: number; row: Record<string, string> } | null {
  const rows = getStore()[tab] ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][keyCol] === value) return { rowNumber: i + 2, row: { ...rows[i] } };
  }
  return null;
}
