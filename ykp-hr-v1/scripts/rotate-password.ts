/**
 * Rotate owner password. Run after bootstrap-sheets when the default owner
 * user already exists and you need to set a new password.
 *   SEED_PASSWORD='new-strong-password' npx tsx scripts/rotate-password.ts
 *
 * Security: refuses weak or common default passwords.
 */
import { findRow, updateRow, TABS } from '../src/db/sheets';
import bcrypt from 'bcryptjs';
import { nowTimestampWib } from '../src/lib/format';

function isWeakPassword(pw: string): boolean {
  const common = ['owner123', 'password123', 'admin123', '12345678', 'qwerty123', 'letmein', 'password', 'admin'];
  if (common.includes(pw.toLowerCase())) return true;
  if (pw.length < 12) return true;
  return false;
}

async function main(): Promise<void> {
  const username = process.env.SEED_USERNAME ?? 'owner';
  const password = process.env.SEED_PASSWORD;

  if (!password) {
    console.error('[rotate-password] ERROR: SEED_PASSWORD env var is required');
    process.exit(1);
  }

  if (isWeakPassword(password)) {
    console.error('[rotate-password] ERROR: SEED_PASSWORD is too weak or matches a common default password. Use at least 12 chars and avoid "owner123", "password123", etc.');
    process.exit(1);
  }

  const existing = await findRow(TABS.users, 'username', username);
  if (!existing) {
    console.error(`[rotate-password] ERROR: user ${username} does not exist; run scripts/seed-user.ts first`);
    process.exit(1);
  }

  const updated = {
    ...existing.row,
    password_hash: bcrypt.hashSync(password, 10),
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.users, existing.rowNumber, updated);

  console.log(`[rotate-password] password updated for user: ${username}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
