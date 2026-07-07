/**
 * Seed a default owner user. Run after bootstrap-sheets.
 *   npm run sheets:seed-user
 * Default: username 'owner' / password 'owner123'
 *
 * IMPORTANT: rotate this password before production.
 */
import { appendRows, findRow, TABS } from '../src/db/sheets';
import { createHash } from 'crypto';
import { nowTimestampWib } from '../src/lib/format';

function hashPw(p: string): string {
  return createHash('sha256').update(p).digest('hex');
}

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
      password_hash: hashPw(password),
      role: 'owner',
      brand_id: '',
      outlet_id: '',
      active_status: 'active',
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
