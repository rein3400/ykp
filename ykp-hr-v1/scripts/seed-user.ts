/**
 * Seed a default owner user. Run after bootstrap-sheets.
 *   npm run sheets:seed-user
 * Default: username 'owner' / password 'owner123'
 *
 * Password is stored as a bcrypt hash.
 * IMPORTANT: rotate this password before production.
 */
import { appendRows, findRow, TABS } from '../src/db/sheets';
import bcrypt from 'bcryptjs';
import { nowTimestampWib } from '../src/lib/format';

async function main(): Promise<void> {
  const username = process.env.SEED_USERNAME ?? 'owner';
  const password = process.env.SEED_PASSWORD ?? 'owner123';

  const existing = await findRow(TABS.users, 'username', username);
  if (existing) {
    console.log(`[seed-user] user ${username} already exists, skipping`);
    return;
  }
  const now = nowTimestampWib();
  await appendRows(TABS.users, [
    {
      user_id: 'U-001',
      username,
      password_hash: bcrypt.hashSync(password, 10),
      role: 'OWNER',
      brand_id: '',
      outlet_id: '',
      department: '',
      employee_id: '',
      telegram_id: '',
      active_status: 'active',
      must_change_password: 'true',
      created_at: now,
      last_login_at: ''
    }
  ]);
  console.log(`[seed-user] created ${username} / ${password}  — change immediately for production`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
