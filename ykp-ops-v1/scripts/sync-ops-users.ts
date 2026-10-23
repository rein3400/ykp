/**
 * Import HR accounts into Ops (access parity).
 *
 *   tsx scripts/sync-ops-users.ts              # plan
 *   tsx scripts/sync-ops-users.ts --apply
 *
 * Copies existing password hashes verbatim (no password reset), maps roles
 * explicitly, skips collisions/unknown roles, backs up ops_users, audits, and
 * never touches telegram_id (account owners must link the Ops bot themselves).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appendRows, findRow, readTab, TABS, updateRow } from '../src/db/sheets';

async function main(): Promise<void> {
  const ROLE_MAP: Record<string, string> = {
    owner: 'owner',
    super_admin: 'super_admin',
    finance_admin: 'finance_admin',
    brand_manager: 'brand_manager',
    outlet_manager: 'outlet_manager',
    supervisor: 'supervisor',
    viewer: 'viewer',
    employee: 'staff'
  };

  const apply = process.argv.includes('--apply');
  const source = JSON.parse(readFileSync('/tmp/ops-sync-source.json', 'utf8')) as { users: Array<Record<string, string>> };
  if (!Array.isArray(source.users)) throw new Error('Unexpected source shape');

  const target = await readTab<Record<string, string>>(TABS.users);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const plan: Array<{ action: 'CREATE' | 'UPDATE_EMPTY_FIELDS' | 'SKIP'; user: Record<string, string>; role?: string; updates?: Record<string, string>; reason?: string }> = [];

  for (const user of source.users) {
    if (user.active_status !== 'active') continue;
    const role = ROLE_MAP[user.role];
    if (!role) { plan.push({ action: 'SKIP', user, reason: `role '${user.role}' has no Ops equivalent` }); continue; }
    if (target.filter((row) => row.user_id === user.user_id).length > 1) { plan.push({ action: 'SKIP', user, reason: 'duplicate rows in ops_users' }); continue; }
    if (target.some((row) => row.username === user.username && row.user_id !== user.user_id)) { plan.push({ action: 'SKIP', user, reason: 'username conflict with another Ops identity' }); continue; }
    const existing = target.find((row) => row.user_id === user.user_id);
    if (existing) {
      const updates: Record<string, string> = {};
      if (!existing.password_hash && user.password_hash) updates.password_hash = user.password_hash;
      if (!existing.brand_id && user.brand_id) updates.brand_id = user.brand_id;
      if (!existing.outlet_id && user.outlet_id) updates.outlet_id = user.outlet_id;
      if (Object.keys(updates).length) plan.push({ action: 'UPDATE_EMPTY_FIELDS', user, updates });
      continue;
    }
    plan.push({ action: 'CREATE', user, role });
  }

  const actionable = plan.filter((item) => item.action !== 'SKIP');
  const skipped = plan.filter((item) => item.action === 'SKIP');
  console.log(`Mode: ${apply ? 'APPLY' : 'PLAN'} · create/update=${actionable.length} · skipped=${skipped.length}`);
  for (const item of actionable) console.log(item.action, item.user.username, item.role ?? Object.keys(item.updates ?? {}).join(','));
  for (const item of skipped) console.log('SKIP', item.user.username, '—', item.reason);
  if (!apply) process.exit(0);

  mkdirSync('/tmp/ops-user-backup', { recursive: true, mode: 0o700 });
  const backupPath = `/tmp/ops-user-backup/ops-users-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify({ users: target }, null, 2), { mode: 0o600 });

  for (const item of actionable) {
    if (item.action === 'CREATE') {
      const row: Record<string, string> = {
        user_id: item.user.user_id,
        username: item.user.username,
        password_hash: item.user.password_hash || '',
        role: item.role ?? 'staff',
        brand_id: item.user.brand_id || '',
        outlet_id: item.user.outlet_id || '',
        active_status: 'active',
        created_at: now,
        last_login_at: '',
        telegram_id: ''
      };
      await appendRows(TABS.users, [row]);
      await audit('create', row.user_id, Object.keys(row));
    }
    if (item.action === 'UPDATE_EMPTY_FIELDS' && item.updates) {
      const found = await findRow(TABS.users, 'user_id', item.user.user_id);
      if (!found) throw new Error(`Target disappeared: ${item.user.user_id}`);
      await updateRow(TABS.users, found.rowIndex, { ...found.row, ...item.updates });
      await audit('update', item.user.user_id, Object.keys(item.updates));
    }
  }
  console.log(`Backup: ${backupPath}`);

  async function audit(action: string, entityId: string, fields: string[]): Promise<void> {
    await appendRows(TABS.auditLog, [{
      audit_id: `AUD-SYNC-${createHash('sha256').update(entityId + now).digest('hex').slice(0, 12)}`,
      timestamp: now,
      actor_user_id: 'script',
      actor_role: 'system',
      action: `ops_user_${action}`,
      entity: 'ops_user',
      entity_id: entityId,
      before_value: '',
      after_value: JSON.stringify({ fields }),
      reason: 'HR account access parity',
      ip_address: ''
    }]);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
