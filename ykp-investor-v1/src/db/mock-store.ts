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
  hermezAlerts: 'investor_hermes_alert_log',
  telegramDeliveryLog: 'telegram_delivery_log'
} as const;

function seed(): Record<string, Record<string, string>[]> {
  const hp = (p: string) => createHash('sha256').update(p).digest('hex');
  const pw = hp('owner123');
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
    [TAB.capital]: [
      { capital_id: 'CAP-001', investor_id: 'INV-001', date: '2026-01-15', type: 'in', amount: '5000000000', method: 'transfer', reference: 'TRX-20260115-001', note: 'Initial capital injection', created_by: 'owner', created_at: now() },
      { capital_id: 'CAP-002', investor_id: 'INV-001', date: '2026-03-10', type: 'in', amount: '1500000000', method: 'transfer', reference: 'TRX-20260310-002', note: 'Expansion capital - Laju Kopi Bintaro', created_by: 'owner', created_at: now() },
      { capital_id: 'CAP-003', investor_id: 'INV-001', date: '2026-06-01', type: 'out', amount: '250000000', method: 'transfer', reference: 'TRX-20260601-003', note: 'Partial dividend payout Q2', created_by: 'owner', created_at: now() }
    ],
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
    [TAB.dividend]: [
      { dividend_id: 'DIV-001', investor_id: 'INV-001', period: '2026-Q1', amount: '180000000', status: 'paid', declared_at: '2026-04-05 10:00:00', paid_at: '2026-04-10 14:30:00', reference: 'DIV-Q1-2026', created_at: now() },
      { dividend_id: 'DIV-002', investor_id: 'INV-001', period: '2026-Q2', amount: '250000000', status: 'paid', declared_at: '2026-07-01 10:00:00', paid_at: '2026-06-01 09:00:00', reference: 'DIV-Q2-2026', created_at: now() },
      { dividend_id: 'DIV-003', investor_id: 'INV-001', period: '2026-Q3', amount: '200000000', status: 'declared', declared_at: '2026-07-15 10:00:00', paid_at: '', reference: 'DIV-Q3-2026', created_at: now() }
    ],
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
      },
      {
        user_id: 'USR-INV-002',
        username: 'investor1',
        password_hash: hp('invest123'),
        role: 'investor',
        investor_id: 'INV-003',
        active_status: 'active',
        created_at: now(),
        last_login_at: ''
      },
      {
        user_id: 'USR-INV-003',
        username: 'investor2',
        password_hash: hp('invest123'),
        role: 'investor',
        investor_id: 'INV-005',
        active_status: 'active',
        created_at: now(),
        last_login_at: ''
      },
      {
        user_id: 'USR-INV-004',
        username: 'investor_inst',
        password_hash: hp('invest123'),
        role: 'investor',
        investor_id: 'INV-002',
        active_status: 'active',
        created_at: now(),
        last_login_at: ''
      },
      {
        user_id: 'USR-INV-005',
        username: 'viewer',
        password_hash: hp('viewer12'),
        role: 'viewer',
        investor_id: '',
        active_status: 'active',
        created_at: now(),
        last_login_at: ''
      }
    ],
    [TAB.auditLog]: [],
    [TAB.hermezAlerts]: [],
    [TAB.telegramDeliveryLog]: []
  };
}

// Dev-mode (Turbopack) gives each route-handler bundle its own module graph,
// so a module-level `let store` is NOT shared between routes. Hoist onto
// globalThis so all graphs in this Node process share ONE store.
const SEED_VERSION = 2; // bump when seed() data changes to force a clean re-seed
const GLOBAL_KEY = `__YKP_INVESTOR_MOCK_STORE_V${SEED_VERSION}__`;
const g = globalThis as unknown as Record<string, Record<string, Record<string, string>[]> | undefined>;
function getStore() {
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = seed();
  return g[GLOBAL_KEY]!;
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
