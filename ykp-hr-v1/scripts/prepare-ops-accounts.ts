/**
 * Prepare HR accounts for Ops access parity (one-off, audited).
 *
 *   1. PLAN by default; pass --apply to write.
 *   2. Deactivates duplicate user_id rows (keeps the row linked to Telegram).
 *   3. Reconciles an account's brand/outlet with its employee record ONLY when
 *      the employee row exists, is active, and the account contradicts it.
 *   4. Exports minimal account fields to a 0600 file for the Ops import.
 *
 * Password hashes are copied, never reset. Never log or commit the export.
 */
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { appendRows, readTab, updateRow, TABS } from '../src/db/sheets';

const apply = process.argv.includes('--apply');
const outPath = process.argv.find((arg) => arg.endsWith('.json')) ?? '/tmp/ops-sync-source.json';
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

const [users, employees] = await Promise.all([
  readTab<Record<string, string>>(TABS.users),
  readTab<Record<string, string>>(TABS.employees)
]);

const actions: Array<Record<string, unknown>> = [];

// 1) Duplicate user_id rows: keep the Telegram-linked row, deactivate the rest.
const byId = new Map<string, Array<{ rowIndex: number; row: Record<string, string>; index: number }>>();
users.forEach((row, index) => {
  if (!row.user_id) return;
  const list = byId.get(row.user_id) ?? [];
  list.push({ rowIndex: index + 2, row, index });
  byId.set(row.user_id, list);
});
for (const [userId, rows] of byId) {
  if (rows.length < 2) continue;
  const keep = rows.find((entry) => entry.row.telegram_id?.trim()) ?? rows[0];
  for (const entry of rows) {
    if (entry === keep) continue;
    if (entry.row.active_status === 'inactive') continue;
    actions.push({ action: 'DEACTIVATE_DUPLICATE', user_id: userId, rowIndex: entry.rowIndex, username: entry.row.username });
  }
}

// 2) Account brand/outlet reconciliation against the employee record.
for (const row of users) {
  if (!row.employee_id || !row.user_id) continue;
  const employee = employees.find((candidate) => candidate.employee_id === row.employee_id);
  if (!employee || employee.active_status !== 'active') continue;
  const next: Record<string, string> = {};
  if (employee.brand_id && row.brand_id && row.brand_id !== employee.brand_id) next.brand_id = employee.brand_id;
  if (employee.outlet_id && row.outlet_id && row.outlet_id !== employee.outlet_id) next.outlet_id = employee.outlet_id;
  if (Object.keys(next).length) {
    actions.push({ action: 'RECONCILE_SCOPE', user_id: row.user_id, username: row.username, fields: Object.keys(next) });
  }
}

console.log(`Mode: ${apply ? 'APPLY' : 'PLAN'} · actions=${actions.length}`);
for (const item of actions) console.log(JSON.stringify(item));
if (!apply) process.exit(0);

mkdirSync('/tmp/hr-user-backup', { recursive: true, mode: 0o700 });
writeFileSync(`/tmp/hr-user-backup/hr-users-${Date.now()}.json`, JSON.stringify(users, null, 2), { mode: 0o600 });

for (const item of actions) {
  if (item.action === 'DEACTIVATE_DUPLICATE') {
    const rowIndex = Number(item.rowIndex);
    const current = users[rowIndex - 2];
    if (!current) throw new Error(`Row vanished: ${String(item.user_id)}`);
    await updateRow(TABS.users, rowIndex, { ...current, active_status: 'inactive', updated_at: now });
    await audit('deactivate_duplicate', String(item.user_id), { active_status: 'inactive' });
  }
  if (item.action === 'RECONCILE_SCOPE') {
    const current = users.find((candidate) => candidate.user_id === item.user_id);
    const employee = employees.find((candidate) => candidate.employee_id === current?.employee_id);
    if (!current || !employee) continue;
    const rowIndex = users.indexOf(current) + 2;
    await updateRow(TABS.users, rowIndex, { ...current, brand_id: employee.brand_id || current.brand_id, outlet_id: employee.outlet_id || current.outlet_id, updated_at: now });
    await audit('reconcile_scope', String(item.user_id), { brand_id: employee.brand_id, outlet_id: employee.outlet_id });
  }
}

const refreshed = await readTab<Record<string, string>>(TABS.users);
const seen = new Set<string>();
const exported = refreshed
  .filter((row) => row.user_id && row.username && row.active_status === 'active' && !seen.has(row.user_id) && Boolean(seen.add(row.user_id)))
  .map((row) => {
    const employee = employees.find((candidate) => candidate.employee_id === row.employee_id);
    return {
      user_id: row.user_id,
      username: row.username,
      password_hash: row.password_hash ?? '',
      role: row.role ?? '',
      brand_id: row.brand_id || employee?.brand_id || '',
      outlet_id: row.outlet_id || employee?.outlet_id || '',
      employee_id: row.employee_id || '',
      active_status: row.active_status ?? ''
    };
  });
writeFileSync(outPath, JSON.stringify({ exported_at: now, users: exported }, null, 2), { mode: 0o600 });
chmodSync(outPath, 0o600);
console.log(`Exported ${exported.length} active unique HR accounts to ${outPath} (hashes not printed)`);

async function audit(action: string, entityId: string, after: Record<string, string>): Promise<void> {
  await appendRows(TABS.auditLog, [{
    audit_id: `AUD-OPSACC-${now}-${entityId}`,
    timestamp: now,
    actor_user_id: 'script',
    actor_role: 'system',
    action,
    entity: 'user',
    entity_id: entityId,
    before_value: '',
    after_value: JSON.stringify(after)
  }]);
}
