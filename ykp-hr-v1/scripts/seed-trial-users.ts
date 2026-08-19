/**
 * Seed trial accounts — one per division/role for the pilot.
 * Safe to run repeatedly — skips existing usernames.
 *
 * Accounts (username / password):
 *   owner        / owner123
 *   superadmin   / superadmin123
 *   hradmin      / hradmin123
 *   finance      / finance123
 *   brandmgr     / brandmgr123
 *   outletmgr    / outletmgr123
 *   supervisor   / supervisor123
 *   employee     / employee123
 *   viewer       / viewer123
 *
 * All accounts are created with must_change_password='true' so the first
 * login forces the user to set their own password (HR never knows it).
 *
 * Usage:
 *   npm run sheets:seed-trial
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL + YKP_HR_SPREADSHEET_ID in .env
 * (or set USE_MOCK_DB=true to preview against the in-memory store).
 */
import { TABS, readTab, appendRows } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import { hashPassword } from '../src/lib/password';

interface TrialUser {
  username: string;
  password: string;
  role: string;
  label: string;
}

const TRIAL_USERS: TrialUser[] = [
  { username: 'owner', password: 'owner123', role: 'owner', label: 'Owner' },
  { username: 'superadmin', password: 'superadmin123', role: 'super_admin', label: 'Super Admin' },
  { username: 'hradmin', password: 'hradmin123', role: 'hr_admin', label: 'HR Admin' },
  { username: 'finance', password: 'finance123', role: 'finance_admin', label: 'Finance Admin' },
  { username: 'brandmgr', password: 'brandmgr123', role: 'brand_manager', label: 'Brand Manager' },
  { username: 'outletmgr', password: 'outletmgr123', role: 'outlet_manager', label: 'Outlet Manager' },
  { username: 'supervisor', password: 'supervisor123', role: 'supervisor', label: 'Supervisor' },
  { username: 'employee', password: 'employee123', role: 'employee', label: 'Employee' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', label: 'Viewer' }
];

async function main(): Promise<void> {
  const now = nowTimestampWib();

  const [existingUsers, brands, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.users),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets)
  ]);

  const unames = new Set(existingUsers.map((u) => u.username));
  const brandId = brands[0]?.brand_id || '';
  const outletId = outlets[0]?.outlet_id || '';

  // Next sequential USR- id.
  let max = 0;
  for (const u of existingUsers) {
    const m = (u.user_id || '').match(/^USR-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }

  const newUsers: Record<string, string>[] = [];
  for (const t of TRIAL_USERS) {
    if (unames.has(t.username)) {
      console.log(`[seed-trial] skip ${t.username} (already exists)`);
      continue;
    }
    max += 1;
    newUsers.push({
      user_id: `USR-${String(max).padStart(3, '0')}`,
      username: t.username,
      password_hash: await hashPassword(t.password),
      role: t.role,
      brand_id: brandId,
      outlet_id: outletId,
      department: t.label,
      employee_id: '',
      telegram_id: '',
      active_status: 'active',
      must_change_password: 'true',
      created_at: now,
      last_login_at: ''
    });
  }

  if (newUsers.length === 0) {
    console.log('[seed-trial] all trial users already exist, nothing to add');
    return;
  }

  await appendRows(TABS.users, newUsers);
  console.log(`[seed-trial] added ${newUsers.length} trial account(s):`);
  for (const u of newUsers) {
    const t = TRIAL_USERS.find((x) => x.username === u.username);
    console.log(`  ${u.username} / ${t?.password}  (${t?.label}, role=${u.role})`);
  }
  console.log('\nSemua akun wajib ganti password saat login pertama (must_change_password=true).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
