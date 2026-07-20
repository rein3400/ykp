/**
 * Seed default owner user. Run: npm run sheets:seed-user
 *
 * Security: no hardcoded password. SEED_PASSWORD env var is used, or a random
 * 16-character password is generated and printed once.
 */
import { getSheetsClient, getSpreadsheetId, TABS } from '../src/db/sheets';
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

function isWeakPassword(pw: string): boolean {
  const common = ['owner123', 'password123', 'admin123', '12345678', 'qwerty123', 'letmein', 'password', 'admin'];
  if (common.includes(pw.toLowerCase())) return true;
  if (pw.length < 12) return true;
  return false;
}

async function main(): Promise<void> {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const tab = TABS.users;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${tab}!A2:A2`
  });
  if (res.data.values?.[0]?.[0]) {
    console.log('users tab already seeded');
    return;
  }

  const username = process.env.SEED_USERNAME ?? 'owner';
  const explicitPassword = process.env.SEED_PASSWORD;
  const password = explicitPassword ?? generatePassword();
  const generated = !explicitPassword;

  if (!generated && isWeakPassword(password)) {
    console.error('[seed-user] ERROR: SEED_PASSWORD is too weak or matches a common default password. Use at least 12 chars and avoid "owner123", "password123", etc.');
    process.exit(1);
  }

  const pw = bcrypt.hashSync(password, 10);
  const row = [
    'USR-001', username, pw, 'owner', '', '', 'active', nowTimestampWib(), ''
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${tab}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });

  console.log(`[seed-user] created user: ${username}`);
  if (generated) {
    console.log('=== ONE-TIME GENERATED PASSWORD ===');
    console.log(password);
    console.log('====================================');
  } else {
    console.log('[seed-user] password set from SEED_PASSWORD env var');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});