/**
 * Seed extra HR users only (admin, supervisor, staff).
 * Safe to run repeatedly — skips existing usernames.
 */
import { getSheetsClient, getSpreadsheetId, TABS, readTab, appendRows } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import { createHash } from 'crypto';

const hashPw = (p: string) => createHash('sha256').update(p).digest('hex');

async function main() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.YKP_HR_SPREADSHEET_ID) {
    throw new Error('Need GOOGLE_SERVICE_ACCOUNT_EMAIL + YKP_HR_SPREADSHEET_ID');
  }
  process.env.USE_MOCK_DB = 'false';
  const now = nowTimestampWib();
  console.log('[seed-users] spreadsheet', getSpreadsheetId());

  const existingBrands = await readTab(TABS.brands);
  const existingOutlets = await readTab(TABS.outlets);
  const brandId = existingBrands[0]?.brand_id || 'BR-001';
  const outletId = existingOutlets[0]?.outlet_id || 'OL-001';

  const users = [
    { user_id: 'USR-HR-002', username: 'admin', password: 'admin123', role: 'admin', brand_id: brandId, outlet_id: outletId },
    { user_id: 'USR-HR-003', username: 'supervisor', password: 'supervisor123', role: 'supervisor', brand_id: brandId, outlet_id: outletId },
    { user_id: 'USR-HR-004', username: 'staff1', password: 'staff123', role: 'staff', brand_id: brandId, outlet_id: outletId },
  ];

  const existingUsers = await readTab(TABS.users);
  const unames = new Set(existingUsers.map((u) => u.username));
  const newUsers = users
    .filter((u) => !unames.has(u.username))
    .map((u) => ({
      user_id: u.user_id,
      username: u.username,
      password_hash: hashPw(u.password),
      role: u.role,
      brand_id: u.brand_id,
      outlet_id: u.outlet_id,
      department: '',
      employee_id: '',
      telegram_id: '',
      active_status: 'active',
      created_at: now,
      last_login_at: '',
    }));

  if (newUsers.length === 0) {
    console.log('[seed-users] all users already exist, skipping');
    return;
  }
  await appendRows(TABS.users, newUsers);
  console.log(`[seed-users] added ${newUsers.length} users`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
