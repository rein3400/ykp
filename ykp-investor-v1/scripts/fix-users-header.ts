/**
 * Restore warehouse `users` header after accidental overwrite by investor bootstrap,
 * and force-seed investor_users with owner + mega users.
 *
 * Security: no hardcoded passwords. Use SEED_PASSWORD for owner and
 * INVESTOR_DEFAULT_PASSWORD for sample investors, or random passwords are generated.
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, columnLetter, appendRows, findRow } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
}

async function main() {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const now = nowTimestampWib();

  // 1) Restore warehouse users header (9 cols)
  const whUsersHeaders = [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at'
  ];
  console.log('[fix] restoring warehouse users header');
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `users!A1:${columnLetter(whUsersHeaders.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [whUsersHeaders] }
  });

  // Ensure warehouse owner active_status is correct on row 2 if present
  const whUsers = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: 'users!A2:I10'
  });
  const rows = whUsers.data.values ?? [];
  const ownerPassword = process.env.SEED_PASSWORD ?? generatePassword();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] === 'owner') {
      r[2] = bcrypt.hashSync(ownerPassword, 10);
      r[3] = 'owner';
      r[6] = 'active';
      await sheets.spreadsheets.values.update({
        spreadsheetId: sid,
        range: `users!A${i + 2}:I${i + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: [r.concat(Array(9 - r.length).fill('')).slice(0, 9)] }
      });
      console.log('[fix] warehouse owner row repaired');
    }
  }
  await sleep(800);

  // 2) Ensure investor_users tab + headers + owner seed
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  for (const tab of [TABS.users, TABS.auditLog, TABS.hermezAlerts, TABS.capital, TABS.shareholding, TABS.dividend]) {
    if (!titles.has(tab)) {
      console.log('[fix] creating tab', tab);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
      });
      await sleep(1000);
    }
    const headers = TAB_HEADERS[tab];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${tab}!A1:${columnLetter(headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });
    await sleep(800);
  }

  const existing = await findRow(TABS.users, 'username', 'owner');
  if (!existing) {
    await appendRows(TABS.users, [{
      user_id: 'USR-001',
      username: 'owner',
      password_hash: bcrypt.hashSync(ownerPassword, 10),
      role: 'owner',
      investor_id: '',
      active_status: 'active',
      created_at: now,
      last_login_at: ''
    }]);
    console.log('[fix] investor_users owner seeded');
  } else {
    const { updateRow } = await import('../src/db/sheets');
    await updateRow(TABS.users, existing.rowNumber, {
      ...existing.row,
      password_hash: bcrypt.hashSync(ownerPassword, 10),
      role: 'owner',
      active_status: 'active'
    });
    console.log('[fix] investor_users owner repaired');
  }

  const investorPassword = process.env.INVESTOR_DEFAULT_PASSWORD ?? generatePassword();
  const generatedInvestors = [] as { username: string; password: string }[];
  for (const u of [
    { id: 'USR-INV-002', username: 'investor1', role: 'investor', investor_id: 'INV-003' },
    { id: 'USR-INV-003', username: 'investor2', role: 'investor', investor_id: 'INV-005' },
    { id: 'USR-INV-004', username: 'investor_inst', role: 'investor', investor_id: 'INV-002' }
  ]) {
    const found = await findRow(TABS.users, 'username', u.username);
    if (!found) {
      await appendRows(TABS.users, [{
        user_id: u.id,
        username: u.username,
        password_hash: bcrypt.hashSync(investorPassword, 10),
        role: u.role,
        investor_id: u.investor_id,
        active_status: 'active',
        created_at: now,
        last_login_at: ''
      }]);
      console.log('[fix] seeded', u.username);
      generatedInvestors.push({ username: u.username, password: investorPassword });
      await sleep(500);
    }
  }

  if (!process.env.SEED_PASSWORD) {
    console.log('=== OWNER PASSWORD ===');
    console.log(ownerPassword);
    console.log('======================');
  }
  if (generatedInvestors.length > 0 && !process.env.INVESTOR_DEFAULT_PASSWORD) {
    console.log('=== GENERATED INVESTOR PASSWORDS ===');
    for (const g of generatedInvestors) {
      console.log(`  ${g.username}: ${g.password}`);
    }
    console.log('====================================');
  }

  console.log('[fix] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
