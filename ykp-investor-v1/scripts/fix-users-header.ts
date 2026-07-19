/**
 * Restore warehouse `users` header after accidental overwrite by investor bootstrap,
 * and force-seed investor_users with owner + mega users.
 */
import { getSheetsClient, getSpreadsheetId, TAB_HEADERS, TABS, columnLetter, appendRows, findRow } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] === 'owner') {
      // ensure password hash + active
      const hash = bcrypt.hashSync('owner123', 10);
      r[2] = hash;
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
    const hash = bcrypt.hashSync('owner123', 10);
    await appendRows(TABS.users, [{
      user_id: 'USR-001',
      username: 'owner',
      password_hash: hash,
      role: 'owner',
      investor_id: '',
      active_status: 'active',
      created_at: now,
      last_login_at: ''
    }]);
    console.log('[fix] investor_users owner seeded');
  } else {
    // repair active + password
    const hash = bcrypt.hashSync('owner123', 10);
    const { updateRow } = await import('../src/db/sheets');
    await updateRow(TABS.users, existing.rowNumber, {
      ...existing.row,
      password_hash: hash,
      role: 'owner',
      active_status: 'active'
    });
    console.log('[fix] investor_users owner repaired');
  }

  // seed extra investor users if missing
  for (const u of [
    { id: 'USR-INV-002', username: 'investor1', password: 'invest123', role: 'investor', investor_id: 'INV-003' },
    { id: 'USR-INV-003', username: 'investor2', password: 'invest123', role: 'investor', investor_id: 'INV-005' },
    { id: 'USR-INV-004', username: 'investor_inst', password: 'invest123', role: 'investor', investor_id: 'INV-002' }
  ]) {
    const found = await findRow(TABS.users, 'username', u.username);
    if (!found) {
      await appendRows(TABS.users, [{
        user_id: u.id,
        username: u.username,
        password_hash: bcrypt.hashSync(u.password, 10),
        role: u.role,
        investor_id: u.investor_id,
        active_status: 'active',
        created_at: now,
        last_login_at: ''
      }]);
      console.log('[fix] seeded', u.username);
      await sleep(500);
    }
  }

  console.log('[fix] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
