/**
 * Bootstrap: idempotently create all required tabs with header rows in
 * the configured spreadsheet. Run once before first use:
 *   npm run sheets:bootstrap
 *
 * Also seeds master brands + 5 roles (RBAC matrix per brief §9).
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, type TabName } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';

const SEED_BRANDS = [
  ['BR-001', 'Funkydak', 'FKD', 'active', nowTimestampWib(), nowTimestampWib(), 'system', 'system'],
  ['BR-002', 'Sekarpizza', 'SKP', 'active', nowTimestampWib(), nowTimestampWib(), 'system', 'system'],
  ['BR-003', 'Suburbuns', 'SBN', 'active', nowTimestampWib(), nowTimestampWib(), 'system', 'system'],
  ['BR-004', 'Laju Kopi', 'LJK', 'active', nowTimestampWib(), nowTimestampWib(), 'system', 'system'],
  ['BR-005', 'Uncle Masala', 'UMS', 'active', nowTimestampWib(), nowTimestampWib(), 'system', 'system']
];

const SEED_ROLES = [
  ['R-001', 'Owner', 'Executive', 100, 'active', nowTimestampWib()],
  ['R-002', 'Super Admin', 'IT', 90, 'active', nowTimestampWib()],
  ['R-003', 'HR Admin', 'HR', 80, 'active', nowTimestampWib()],
  ['R-004', 'Finance Admin', 'Finance', 80, 'active', nowTimestampWib()],
  ['R-005', 'Brand Manager', 'Operations', 60, 'active', nowTimestampWib()],
  ['R-006', 'Outlet Manager', 'Operations', 50, 'active', nowTimestampWib()],
  ['R-007', 'Supervisor', 'Operations', 30, 'active', nowTimestampWib()],
  ['R-008', 'Employee', 'Staff', 10, 'active', nowTimestampWib()],
  ['R-009', 'Viewer', 'Read-only', 1, 'active', nowTimestampWib()]
];

const SEED_LEAVE_TYPES = [
  ['LT-001', 'ANNUAL_LEAVE', true, false, 'active', nowTimestampWib()],
  ['LT-002', 'SICK', true, true, 'active', nowTimestampWib()],
  ['LT-003', 'PERMISSION', false, false, 'active', nowTimestampWib()],
  ['LT-004', 'UNPAID_LEAVE', false, false, 'active', nowTimestampWib()],
  ['LT-005', 'EMERGENCY', true, false, 'active', nowTimestampWib()],
  ['LT-006', 'MATERNITY', true, true, 'active', nowTimestampWib()],
  ['LT-007', 'OTHER', false, false, 'active', nowTimestampWib()]
];

const SEED_LATENESS_RULES = [
  [
    'LR-001',
    'Default 10min tolerance, per-minute',
    '',
    '',
    '10',
    'PER_MINUTE',
    '0',
    '5000',
    '150000',
    'active',
    nowTimestampWib()
  ]
];

async function ensureTab(sheets: ReturnType<typeof getSheetsClient>, sid: string, tab: TabName): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab) ?? false;
  if (!exists) {
    console.log(`[bootstrap] creating tab: ${tab}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }]
      }
    });
  }
  // Always rewrite header row (idempotent if identical)
  const headers = TAB_HEADERS[tab];
  const lastCol = String.fromCharCode(64 + headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `'${tab}'!A1:${lastCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

async function seedIfEmpty(
  sheets: ReturnType<typeof getSheetsClient>,
  sid: string,
  tab: TabName,
  rows: string[][]
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `'${tab}'!A2:A2`
  });
  const existing = res.data.values?.[0]?.[0];
  if (existing && existing !== '') {
    console.log(`[seed] ${tab} already has data, skipping seed`);
    return;
  }
  if (rows.length === 0) return;
  console.log(`[seed] ${tab} -> ${rows.length} rows`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `'${tab}'!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
}

async function main(): Promise<void> {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();

  console.log('[bootstrap] spreadsheet:', sid);
  for (const tab of Object.values(TABS)) {
    await ensureTab(sheets, sid, tab);
  }
  await seedIfEmpty(sheets, sid, TABS.brands, SEED_BRANDS);
  await seedIfEmpty(sheets, sid, TABS.roles, SEED_ROLES);
  await seedIfEmpty(sheets, sid, TABS.leaveTypes, SEED_LEAVE_TYPES);
  await seedIfEmpty(sheets, sid, TABS.latenessRules, SEED_LATENESS_RULES);
  console.log('[bootstrap] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
