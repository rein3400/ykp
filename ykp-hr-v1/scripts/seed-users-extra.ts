/**
 * Seed extra HR users only (admin, supervisor, staff).
 * Safe to run repeatedly — skips existing usernames.
 *
 * Passwords are taken from env vars:
 *   SEED_ADMIN_PASSWORD, SEED_SUPERVISOR_PASSWORD, SEED_STAFF_PASSWORD
 * If omitted, random 12-char passwords are generated and printed.
 */
import { getSheetsClient, getSpreadsheetId, TABS, readTab, appendRows } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
}

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
    { user_id: 'USR-HR-002', username: 'admin', role: 'admin', brand_id: brandId, outlet_id: outletId, envKey: 'SEED_ADMIN_PASSWORD' },
    { user_id: 'USR-HR-003', username: 'supervisor', role: 'supervisor', brand_id: brandId, outlet_id: outletId, envKey: 'SEED_SUPERVISOR_PASSWORD' },
    { user_id: 'USR-HR-004', username: 'staff1', role: 'staff', brand_id: brandId, outlet_id: outletId, envKey: 'SEED_STAFF_PASSWORD' },
  ];

  const generated: { username: string; password: string }[] = [];
  const existingUsers = await readTab(TABS.users);
  const unames = new Set(existingUsers.map((u) => u.username));
  const newUsers = users
    .filter((u) => !unames.has(u.username))
    .map((u) => {
      const explicit = process.env[u.envKey];
      const password = explicit ?? generatePassword();
      if (!explicit) generated.push({ username: u.username, password });
      return {
        user_id: u.user_id,
        username: u.username,
        password_hash: bcrypt.hashSync(password, 10),
        role: u.role,
        brand_id: u.brand_id,
        outlet_id: u.outlet_id,
        active_status: 'active',
        created_at: now,
        last_login_at: '',
      };
    });

  if (newUsers.length === 0) {
    console.log('[seed-users] all users already exist, skipping');
    return;
  }
  await appendRows(TABS.users, newUsers);
  console.log(`[seed-users] added ${newUsers.length} users`);
  if (generated.length > 0) {
    console.log('=== GENERATED PASSWORDS ===');
    for (const g of generated) {
      console.log(`${g.username}: ${g.password}`);
    }
    console.log('===========================');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
