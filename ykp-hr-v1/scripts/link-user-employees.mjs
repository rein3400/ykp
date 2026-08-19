/**
 * Backfill the `employee_id` column on the `users` tab so EMPLOYEE accounts
 * are explicitly linked to their master_employee row (self-only RBAC).
 *
 * Without this column, the login route falls back to the U-EMP-N → Nth
 * employee index mapping, which is correct for the seed-employee-users.mjs
 * seed order but fragile. Running this makes the link explicit and durable.
 *
 * Usage:
 *   set GOOGLE_SERVICE_ACCOUNT_EMAIL=...
 *   set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...   (\n literal OK)
 *   set YKP_HR_SPREADSHEET_ID=...
 *   node scripts/link-user-employees.mjs
 *
 * Idempotent: only writes the employee_id cell when it is empty.
 */
import { google } from 'googleapis';

function env(key) {
  const v = process.env[key];
  if (!v) { console.error(`Missing env ${key}`); process.exit(1); }
  return v;
}

async function main() {
  const email = env('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  let privateKey = env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
  const sheetId = env('YKP_HR_SPREADSHEET_ID');

  const auth = new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. users tab (columns: A user_id, B username, ... J employee_id)
  const u = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'users!A1:J200' });
  const uRows = u.data.values || [];
  const uHeader = uRows[0] || [];
  const empColIdx = uHeader.findIndex((h) => h === 'employee_id');
  if (empColIdx === -1) {
    console.error('users tab has no "employee_id" header column. Add it first (column J).');
    process.exit(1);
  }
  const usernameColIdx = uHeader.findIndex((h) => h === 'username');

  // 2. employees tab
  const e = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'master_employee!A1:V200' });
  const eRows = e.data.values || [];
  const eHeader = eRows[0] || [];
  const eIdCol = eHeader.findIndex((h) => h === 'employee_id');
  const eNameCol = eHeader.findIndex((h) => h === 'full_name');
  const eNickCol = eHeader.findIndex((h) => h === 'nickname');
  const eOutletCol = eHeader.findIndex((h) => h === 'outlet_id');
  const eBrandCol = eHeader.findIndex((h) => h === 'brand_id');
  const employees = eRows.slice(1).map((r) => ({
    employee_id: r[eIdCol] || '',
    full_name: r[eNameCol] || '',
    nickname: r[eNickCol] || '',
    outlet_id: r[eOutletCol] || '',
    brand_id: r[eBrandCol] || ''
  }));

  // 3. For each user with role EMPLOYEE/SUPERVISOR/OUTLET_MANAGER/BRAND_MANAGER
  //    whose employee_id cell is empty, link by matching username's first name
  //    to employee nickname/full_name (the seed convention firstname.emp{N}).
  const empColLetter = String.fromCharCode(65 + empColIdx); // A..
  const writes = [];
  let linked = 0;
  for (let i = 1; i < uRows.length; i++) {
    const row = uRows[i];
    const username = row[usernameColIdx] || '';
    const existing = row[empColIdx] || '';
    if (existing.trim()) continue; // idempotent
    if (!username) continue;
    // Match by firstname (seed: sari.emp1 → nickname "Sari" or full_name starts Sari)
    const firstName = username.split('.')[0].toLowerCase();
    const match = employees.find((em) => {
      const nick = (em.nickname || '').toLowerCase().replace(/[^a-z]/g, '');
      const first = (em.full_name || '').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
      return nick === firstName || first === firstName;
    });
    if (match) {
      const rowNum = i + 1; // sheet rows are 1-indexed, header is row 1
      writes.push({ range: `users!${empColLetter}${rowNum}`, values: [[match.employee_id]] });
      console.log(`link ${username} -> ${match.employee_id} (${match.full_name}) [outlet ${match.outlet_id}]`);
      linked++;
    } else {
      console.warn(`no employee match for ${username} (firstname=${firstName})`);
    }
  }

  if (writes.length === 0) {
    console.log('Nothing to link — all employee_id cells already set or no matches.');
    return;
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: 'RAW', data: writes }
  });
  console.log(`Done. Linked ${linked} user(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });