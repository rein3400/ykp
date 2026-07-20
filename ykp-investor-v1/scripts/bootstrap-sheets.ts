/**
 * Bootstrap: idempotently create all required tabs + seed owner user.
 *   npm run sheets:bootstrap
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, columnLetter, type TabName } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
}

function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab}'`;
}

async function ensureTab(sheets: ReturnType<typeof getSheetsClient>, sid: string, tab: TabName): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab) ?? false;
  if (!exists) {
    console.log(`[bootstrap] creating tab: ${tab}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  }
  const headers = TAB_HEADERS[tab];
  const lastCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid, range: `${quoteTab(tab)}!A1:${lastCol}1`,
    valueInputOption: 'RAW', requestBody: { values: [headers] }
  });
}

async function seedUser(sheets: ReturnType<typeof getSheetsClient>, sid: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${quoteTab(TABS.users)}!A2:A2`
  });
  if (res.data.values?.[0]?.[0]) {
    console.log('[seed] users already seeded');
    return;
  }
  const explicitPassword = process.env.SEED_PASSWORD;
  const password = explicitPassword ?? generatePassword();
  if (!explicitPassword && password.length < 12) {
    throw new Error('SEED_PASSWORD must be at least 12 characters');
  }
  const pw = bcrypt.hashSync(password, 10);
  const row = ['USR-001', 'owner', pw, 'owner', '', 'active', nowTimestampWib(), ''];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid, range: `${quoteTab(TABS.users)}!A2`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  console.log(`[seed] created user: owner`);
  if (!explicitPassword) {
    console.log('=== ONE-TIME GENERATED PASSWORD ===');
    console.log(password);
    console.log('====================================');
  } else {
    console.log('[seed] password set from SEED_PASSWORD env var');
  }
}

async function seedSampleInvestor(sheets: ReturnType<typeof getSheetsClient>, sid: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range: `${quoteTab(TABS.investors)}!A2:A2`
  });
  if (res.data.values?.[0]?.[0]) return;
  const rows = [
    ['INV-001', 'YKP Owner', 'owner@ykp.id', '081234000000', 'PT YKP', 'founder', '2024-01-01', 'active', 'Founder', nowTimestampWib()]
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid, range: `${quoteTab(TABS.investors)}!A2`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
  console.log('[seed] investors -> 1 sample (INV-001)');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  console.log('[bootstrap] spreadsheet:', sid);
  const tabs = Object.values(TABS);
  for (let i = 0; i < tabs.length; i++) {
    await ensureTab(sheets, sid, tabs[i]);
    if (i < tabs.length - 1) await sleep(1500);
  }
  await seedUser(sheets, sid);
  await sleep(800);
  await seedSampleInvestor(sheets, sid);
  console.log('[bootstrap] done');
}

main().catch((e) => { console.error(e); process.exit(1); });