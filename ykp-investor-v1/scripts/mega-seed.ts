/**
 * MEGA mock seed for Investor V1 — multi-investor, multi-brand shareholding,
 * capital history, dividends, dashboard/summary snapshots.
 * Uses multi-tab spreadsheet (shared with warehouse tabs by different names).
 *
 *   npm run sheets:mega-seed
 */
import { appendRows, readTab, TABS } from '../src/db/sheets';
import { nowTimestampWib, formatDateWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number, w = 3) => String(n).padStart(w, '0');
const id = (p: string, n: number) => `MEGA-${p}-${pad(n, 4)}`;
const hashPw = (p: string) => bcrypt.hashSync(p, 10);

function dayOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDateWib(d);
}

async function appendBatched(tab: (typeof TABS)[keyof typeof TABS], rows: Record<string, string>[], size = 40) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await appendRows(tab, chunk);
    console.log(`  [${tab}] +${chunk.length} (${Math.min(i + size, rows.length)}/${rows.length})`);
    await sleep(1200);
  }
}

const BRANDS = [
  { id: 'BR-001', name: 'Funkydak' },
  { id: 'BR-002', name: 'Sekarpizza' },
  { id: 'BR-003', name: 'Suburbuns' },
  { id: 'BR-004', name: 'Laju Kopi' },
  { id: 'BR-005', name: 'Uncle Masala' }
];

const INVESTORS = [
  { id: 'INV-001', name: 'YKP Owner Holding', email: 'owner@ykp.id', phone: '08120000001', company: 'PT YKP Holding', type: 'founder', join: '2023-01-01' },
  { id: 'INV-002', name: 'PT Modal Maju', email: 'contact@modalmaju.id', phone: '08120000002', company: 'PT Modal Maju', type: 'institutional', join: '2023-06-15' },
  { id: 'INV-003', name: 'Andi Wijaya', email: 'andi@example.com', phone: '08120000003', company: '', type: 'individual', join: '2023-09-01' },
  { id: 'INV-004', name: 'Sari Capital Partners', email: 'ops@saricapital.id', phone: '08120000004', company: 'Sari Capital', type: 'institutional', join: '2024-01-20' },
  { id: 'INV-005', name: 'Budi Santoso', email: 'budi@example.com', phone: '08120000005', company: '', type: 'individual', join: '2024-03-10' },
  { id: 'INV-006', name: 'CV Nusantara Ventures', email: 'nv@nusantara.id', phone: '08120000006', company: 'CV Nusantara Ventures', type: 'angel', join: '2024-05-05' },
  { id: 'INV-007', name: 'Rina Kusuma', email: 'rina@example.com', phone: '08120000007', company: '', type: 'individual', join: '2024-07-12' },
  { id: 'INV-008', name: 'Family Office Pratama', email: 'fo@pratama.id', phone: '08120000008', company: 'FO Pratama', type: 'family_office', join: '2024-09-01' },
  { id: 'INV-009', name: 'Joko Prasetyo', email: 'joko@example.com', phone: '08120000009', company: '', type: 'individual', join: '2025-01-15' },
  { id: 'INV-010', name: 'PT Investasi Bahari', email: 'ib@bahari.id', phone: '08120000010', company: 'PT Investasi Bahari', type: 'institutional', join: '2025-04-01' },
  { id: 'INV-011', name: 'Maya Putri', email: 'maya@example.com', phone: '08120000011', company: '', type: 'individual', join: '2025-06-20' },
  { id: 'INV-012', name: 'Seed Fund Asia', email: 'deals@seedfund.asia', phone: '08120000012', company: 'Seed Fund Asia', type: 'vc', join: '2025-08-08' }
];

// shareholding % per brand must sum ~100
const HOLDINGS: Array<{ inv: string; brand: string; pct: number; value: number }> = [
  // Funkydak
  { inv: 'INV-001', brand: 'BR-001', pct: 55, value: 5_500_000_000 },
  { inv: 'INV-002', brand: 'BR-001', pct: 20, value: 2_000_000_000 },
  { inv: 'INV-003', brand: 'BR-001', pct: 10, value: 1_000_000_000 },
  { inv: 'INV-004', brand: 'BR-001', pct: 10, value: 1_000_000_000 },
  { inv: 'INV-005', brand: 'BR-001', pct: 5, value: 500_000_000 },
  // Sekarpizza
  { inv: 'INV-001', brand: 'BR-002', pct: 40, value: 3_200_000_000 },
  { inv: 'INV-006', brand: 'BR-002', pct: 25, value: 2_000_000_000 },
  { inv: 'INV-002', brand: 'BR-002', pct: 20, value: 1_600_000_000 },
  { inv: 'INV-007', brand: 'BR-002', pct: 15, value: 1_200_000_000 },
  // Suburbuns
  { inv: 'INV-001', brand: 'BR-003', pct: 50, value: 2_500_000_000 },
  { inv: 'INV-008', brand: 'BR-003', pct: 30, value: 1_500_000_000 },
  { inv: 'INV-009', brand: 'BR-003', pct: 20, value: 1_000_000_000 },
  // Laju Kopi
  { inv: 'INV-001', brand: 'BR-004', pct: 45, value: 1_800_000_000 },
  { inv: 'INV-010', brand: 'BR-004', pct: 30, value: 1_200_000_000 },
  { inv: 'INV-011', brand: 'BR-004', pct: 15, value: 600_000_000 },
  { inv: 'INV-012', brand: 'BR-004', pct: 10, value: 400_000_000 },
  // Uncle Masala
  { inv: 'INV-001', brand: 'BR-005', pct: 60, value: 1_200_000_000 },
  { inv: 'INV-004', brand: 'BR-005', pct: 25, value: 500_000_000 },
  { inv: 'INV-006', brand: 'BR-005', pct: 15, value: 300_000_000 }
];

async function main() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.YKP_INVESTOR_SPREADSHEET_ID) {
    throw new Error('Need GOOGLE_SERVICE_ACCOUNT_EMAIL + YKP_INVESTOR_SPREADSHEET_ID');
  }
  process.env.USE_MOCK_DB = 'false';
  const now = nowTimestampWib();
  console.log('[investor mega-seed]', process.env.YKP_INVESTOR_SPREADSHEET_ID, now);

  // Investors
  const existingInv = await readTab(TABS.investors);
  const invIds = new Set(existingInv.map((i) => i.investor_id));
  await appendBatched(
    TABS.investors,
    INVESTORS.filter((i) => !invIds.has(i.id)).map((i) => ({
      investor_id: i.id,
      investor_name: i.name,
      email: i.email,
      phone: i.phone,
      company: i.company,
      investor_type: i.type,
      join_date: i.join,
      status: 'active',
      note: 'MEGA seed',
      created_at: now
    }))
  );

  // Shareholding
  let shN = 1;
  const shares = HOLDINGS.map((h) => {
    const brand = BRANDS.find((b) => b.id === h.brand)!;
    return {
      share_id: id('SHR', shN++),
      investor_id: h.inv,
      brand_id: h.brand,
      brand_name: brand.name,
      share_pct: String(h.pct),
      share_value: String(h.value),
      valuation_date: dayOffset(7),
      last_updated: now
    };
  });
  await appendBatched(TABS.shareholding, shares);

  // Capital movements — 18 months history-ish (monthly injects)
  const capital: Record<string, string>[] = [];
  let capN = 1;
  const methods = ['transfer', 'giro', 'cash', 'equity_conversion'];
  for (let m = 0; m < 18; m++) {
    const date = dayOffset(m * 30 + 3);
    // 2–4 capital events per month
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const inv = INVESTORS[Math.floor(Math.random() * INVESTORS.length)];
      const type = Math.random() < 0.85 ? 'IN' : 'OUT';
      const amount = (type === 'IN' ? 50 : 20) * 1_000_000 + Math.floor(Math.random() * 200) * 1_000_000;
      capital.push({
        capital_id: id('CAP', capN++),
        investor_id: inv.id,
        date,
        type,
        amount: String(amount),
        method: methods[Math.floor(Math.random() * methods.length)],
        reference: `TRX-${date.replace(/-/g, '')}-${pad(capN, 4)}`,
        note: type === 'IN' ? 'Capital injection MEGA' : 'Partial withdrawal MEGA',
        created_by: 'USR-001',
        created_at: now
      });
    }
  }
  await appendBatched(TABS.capital, capital);

  // Dividends — quarterly for 6 quarters
  const dividends: Record<string, string>[] = [];
  let divN = 1;
  for (let q = 0; q < 6; q++) {
    const period = `2025-Q${(q % 4) + 1}`;
    const declared = dayOffset(q * 45 + 10);
    for (const h of HOLDINGS) {
      // proportional dividend
      const amount = Math.round((h.value * (0.01 + Math.random() * 0.03)) / 1000) * 1000;
      if (amount < 1_000_000) continue;
      const paid = Math.random() < 0.7;
      dividends.push({
        dividend_id: id('DIV', divN++),
        investor_id: h.inv,
        period: `${period}-${h.brand}`,
        amount: String(amount),
        status: paid ? 'PAID' : q < 2 ? 'DECLARED' : 'PAID',
        declared_at: declared,
        paid_at: paid || q >= 2 ? dayOffset(q * 45) : '',
        reference: paid || q >= 2 ? `PAY-${pad(divN, 5)}` : '',
        created_at: now
      });
    }
  }
  await appendBatched(TABS.dividend, dividends);

  // Dashboard snapshots (weekly 12 weeks)
  const dash: Record<string, string>[] = [];
  for (let w = 0; w < 12; w++) {
    const period = dayOffset(w * 7);
    const totalCapital = HOLDINGS.reduce((s, h) => s + h.value, 0);
    const revenue = 800_000_000 + Math.floor(Math.random() * 400_000_000) + w * 10_000_000;
    const profit = Math.round(revenue * (0.08 + Math.random() * 0.07));
    const divDec = dividends
      .filter((d) => d.declared_at <= period)
      .reduce((s, d) => s + Number(d.amount), 0);
    const divPaid = dividends
      .filter((d) => d.status === 'PAID' && d.paid_at && d.paid_at <= period)
      .reduce((s, d) => s + Number(d.amount), 0);
    dash.push({
      period,
      total_revenue: String(revenue),
      total_profit: String(profit),
      total_capital: String(totalCapital),
      active_investors: String(INVESTORS.length),
      dividend_declared: String(divDec),
      dividend_paid: String(divPaid),
      created_at: now
    });
  }
  await appendBatched(TABS.dashboard, dash);

  // Daily summary last 30 days
  const summaries: Record<string, string>[] = [];
  let baseRev = 25_000_000;
  for (let d = 29; d >= 0; d--) {
    const date = dayOffset(d);
    const revenue = baseRev + Math.floor(Math.random() * 8_000_000);
    const profit = Math.round(revenue * (0.09 + Math.random() * 0.05));
    const growth = ((Math.random() - 0.4) * 10).toFixed(2);
    summaries.push({
      summary_id: id('SUM', 30 - d),
      date,
      total_revenue: String(revenue),
      total_profit: String(profit),
      total_capital: String(HOLDINGS.reduce((s, h) => s + h.value, 0)),
      active_investors: String(INVESTORS.length),
      dividend_declared: String(Math.floor(Math.random() * 50_000_000)),
      growth_pct: growth,
      created_at: now
    });
    baseRev += Math.floor((Math.random() - 0.3) * 500_000);
  }
  await appendBatched(TABS.summary, summaries);

  // Extra users (investor-scoped + owner already from bootstrap)
  const users = [
    { user_id: 'USR-INV-002', username: 'investor1', password: 'invest123', role: 'investor', investor_id: 'INV-003' },
    { user_id: 'USR-INV-003', username: 'investor2', password: 'invest123', role: 'investor', investor_id: 'INV-005' },
    { user_id: 'USR-INV-004', username: 'investor_inst', password: 'invest123', role: 'investor', investor_id: 'INV-002' },
    { user_id: 'USR-INV-005', username: 'viewer', password: 'viewer12', role: 'viewer', investor_id: '' }
  ];
  const existingUsers = await readTab(TABS.users);
  const unames = new Set(existingUsers.map((u) => u.username));
  await appendBatched(
    TABS.users,
    users
      .filter((u) => !unames.has(u.username))
      .map((u) => ({
        user_id: u.user_id,
        username: u.username,
        password_hash: hashPw(u.password),
        role: u.role,
        investor_id: u.investor_id,
        active_status: 'active',
        created_at: now,
        last_login_at: ''
      }))
  );

  // Audit samples
  const audits = Array.from({ length: 40 }, (_, i) => ({
    audit_id: id('AUD', i + 1),
    timestamp: `${dayOffset(i % 20)} ${pad(10 + (i % 10), 2)}:00:00`,
    actor_user_id: i % 3 === 0 ? 'USR-001' : 'USR-INV-002',
    actor_role: i % 3 === 0 ? 'owner' : 'investor',
    action: ['create', 'update', 'login', 'export'][i % 4],
    entity: ['capital', 'dividend', 'shareholding', 'session'][i % 4],
    entity_id: id('ENT', i + 1),
    before_value: '',
    after_value: JSON.stringify({ mega: true, i }),
    reason: 'MEGA seed audit',
    ip_address: `103.10.1.${(i % 200) + 1}`
  }));
  await appendBatched(TABS.auditLog, audits);

  console.log('[investor mega-seed] DONE');
  console.log({
    investors: INVESTORS.length,
    holdings: HOLDINGS.length,
    capital: capital.length,
    dividends: dividends.length,
    dashboard: dash.length,
    summaries: summaries.length
  });
  console.log('Logins: owner/owner123 | investor1/invest123 | investor2/invest123 | investor_inst/invest123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
