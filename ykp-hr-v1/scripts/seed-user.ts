/**
 * Seed a default owner user. Run after bootstrap-sheets.
 *   npm run sheets:seed-user
 *
 * Security: no hardcoded default password. The password is taken from
 * SEED_PASSWORD env var, or a random 16-char password is generated and printed
 * once. Rotate it via the `scripts/rotate-password.ts` script after the first login.
 */
import { appendRows, findRow, TABS } from '../src/db/sheets';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { nowTimestampWib } from '../src/lib/format';

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
}

function isWeakPassword(pw: string): boolean {
  const common = ['owner123', 'password123', 'admin123', '12345678', 'qwerty123', 'letmein', 'password', 'admin'];
  if (common.includes(pw.toLowerCase())) return true;
  if (pw.length < 12) return true;
  return false;
}

async function main(): Promise<void> {
  const username = process.env.SEED_USERNAME ?? 'owner';
  const explicitPassword = process.env.SEED_PASSWORD;
  const password = explicitPassword ?? generatePassword();
  const generated = !explicitPassword;

  if (!generated && isWeakPassword(password)) {
    console.error('[seed-user] ERROR: SEED_PASSWORD is too weak or matches a common default password. Use at least 12 chars and avoid "owner123", "password123", etc.');
    process.exit(1);
  }

  const existing = await findRow(TABS.users, 'username', username);
  if (existing) {
    console.log(`[seed-user] user ${username} already exists, skipping`);
    if (generated) {
      console.log('[seed-user] hint: use scripts/rotate-password.ts to rotate the password of an existing user');
    }
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
      active_status: 'active',
      created_at: now,
      last_login_at: ''
    }
  ]);

  console.log(`[seed-user] created user: ${username}`);
  if (generated) {
    console.log('=== ONE-TIME GENERATED PASSWORD ===');
    console.log(password);
    console.log('====================================');
    console.log('Store this password securely and rotate it via scripts/rotate-password.ts');
  } else {
    console.log('[seed-user] password set from SEED_PASSWORD env var');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
