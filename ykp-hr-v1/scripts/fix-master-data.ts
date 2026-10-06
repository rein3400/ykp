import { readTab, updateRow, appendRows, findRow, TABS } from '../src/db/sheets';
import { logAudit } from '../src/lib/audit';
import { nowTimestampWib } from '../src/lib/format';
import {
  normalizeEmploymentStatus, assertSheetsMigrationEnvironment,
  planOutletMigration, type OutletMigrationRow
} from '../src/lib/master-data';

async function main(): Promise<void> {
  assertSheetsMigrationEnvironment(process.env);
  const apply = process.argv.includes('--apply');
  // --reassign-<ENTITY_ID>=<OL-XXX> moves an active employee/user off an outlet
  // that will be deactivated, in the SAME apply run (owner-confirmed mapping).
  const reassign = new Map<string, string>();
  for (const arg of process.argv) {
    const m = /^--reassign-([A-Za-z0-9-]+)=(OL-\d+)$/.exec(arg);
    if (m) reassign.set(m[1], m[2]);
  }
  const [outlets, brands, employees, users] = await Promise.all([
    readTab<OutletMigrationRow>(TABS.outlets),
    readTab<{ brand_id: string; brand_name: string }>(TABS.brands),
    readTab<Record<string, string>>(TABS.employees),
    readTab<Record<string, string>>(TABS.users)
  ]);
  const plan = planOutletMigration(outlets, brands);
  // End-state active ids (ADD_ACTIVE/RENAME_ACTIVATE/KEEP) — references to ANY
  // outlet outside this set are moved; this makes the migration convergent
  // (re-runnable after partial/legacy states, incl. left-over duplicate rows).
  const finallyActiveIds = new Set(plan.filter((p) => p.action !== 'DEACTIVATE').map((p) => p.id));
  const activeEntityIds = new Set(
    [...employees, ...users].filter((r) => ['active', '1'].includes(r.active_status)).map((r) => r.employee_id || r.user_id)
  );
  // Rows (not entities): duplicate sheet rows for one entity id are handled
  // explicitly — every row must end referencing an active outlet.
  const employeeRows = employees.filter((e) => e.employee_id).map((e) => ({ tab: TABS.employees as 'master_employee', keyCol: 'employee_id', id: e.employee_id, row: e }));
  const userRows = users.filter((u) => u.user_id).map((u) => ({ tab: TABS.users as 'users', keyCol: 'user_id', id: u.user_id, row: u }));
  const allRows = [...employeeRows, ...userRows];
  const byEntity = new Map<string, typeof allRows>();
  for (const r of allRows) byEntity.set(r.id, [...(byEntity.get(r.id) ?? []), r]);
  for (const [id, rows] of byEntity) {
    if (rows.length > 1) console.log(`DUPLICATE ${id}: ${rows.length} sheet rows share this id (reassign/verify will fix every row)`);
  }
  const references = allRows.filter((r) =>
    r.row.outlet_id && !finallyActiveIds.has(r.row.outlet_id) && ['active', '1'].includes(r.row.active_status)
  );
  // Validate reassign mapping against the live plan.
  for (const [entityId, targetId] of reassign) {
    if (!activeEntityIds.has(entityId)) throw new Error(`--reassign: "${entityId}" is not an active employee/user id`);
    const rows = byEntity.get(entityId) ?? [];
    if (!rows.length || !rows.some((r) => !finallyActiveIds.has(r.row.outlet_id))) {
      console.log(`NOTE --reassign: "${entityId}" references only active outlets already — ignored`);
    }
    if (!finallyActiveIds.has(targetId)) throw new Error(`--reassign: target "${targetId}" is not active in this migration plan`);
  }
  const uncovered = references.filter((r) => !reassign.has(r.id));
  const statusPlan = employees.map((employee) => ({
    employee,
    normalized: normalizeEmploymentStatus(employee.employment_status)
  }));
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  for (const operation of plan) console.log(operation.action, operation.id, operation.name, operation.brandId);
  for (const { employee, normalized } of statusPlan) {
    if (!normalized) console.log('UNKNOWN STATUS (untouched):', employee.employee_id, employee.employment_status);
    else if (normalized !== employee.employment_status) console.log('NORMALIZE:', employee.employee_id, employee.employment_status, normalized);
  }
  for (const reference of references) {
    const target = reassign.get(reference.id);
    console.log(target ? `REASSIGN ${reference.id} ${reference.row.outlet_id} → ${target}` : `BLOCKING REFERENCE: ${reference.id} ${reference.row.outlet_id}`);
  }
  for (const entityId of reassign.keys()) {
    if (!references.some((r) => r.id === entityId)) {
      console.log(`IGNORED --reassign ${entityId}: no longer blocked`);
    }
  }
  if (!apply) return;
  if (uncovered.length) {
    throw new Error(
      'Active employees/users reference outlets to deactivate. Pass --reassign-<ENTITY_ID>=<OL-XXX> for: '
      + uncovered.map((r) => `--reassign-${r.id}=<active-OL-id>`).join(' ')
    );
  }

  const currentOutlets = await readTab<OutletMigrationRow>(TABS.outlets);
  if (JSON.stringify(currentOutlets) !== JSON.stringify(outlets)) throw new Error('Outlet data changed since planning; rerun dry-run');
  const now = nowTimestampWib();

  // (1) ADD/RENAME first — target outlets must exist & be active before references move.
  for (const operation of plan) {
    if (operation.action === 'KEEP' || operation.action === 'DEACTIVATE') continue;
    const found = await findRow(TABS.outlets, 'outlet_id', operation.id);
    if (operation.action === 'ADD_ACTIVE' && found) throw new Error(`Outlet ID now occupied: ${operation.id}`);
    if (operation.action !== 'ADD_ACTIVE' && !found) throw new Error(`Outlet disappeared: ${operation.id}`);
    const updated = {
      ...found?.row,
      outlet_id: operation.id,
      outlet_name: operation.name,
      brand_id: operation.brandId,
      status: 'active',
      updated_at: now,
      ...(!found ? { created_at: now } : {})
    };
    if (found) await updateRow(TABS.outlets, found.rowNumber, updated);
    else await appendRows(TABS.outlets, [updated]);
    await logAudit({
      actorUserId: 'script', actorRole: 'system', action: `master_data:${operation.action.toLowerCase()}`,
      entity: 'outlet', entityId: operation.id,
      beforeValue: JSON.stringify(found?.row ?? null), afterValue: JSON.stringify(updated)
    });
  }

  // (2) Reassign EVERY sheet row of the mapped entities (handles duplicate rows).
  for (const [entityId, targetId] of reassign) {
    for (const entry of byEntity.get(entityId) ?? []) {
      if (finallyActiveIds.has(entry.row.outlet_id) || entry.row.outlet_id === targetId) continue;
      const fresh = await findRow(entry.tab, entry.keyCol, entry.id);
      if (!fresh || fresh.row.outlet_id !== entry.row.outlet_id) {
        throw new Error(`Reference changed since plan: ${entityId} (${entry.keyCol})`);
      }
      await updateRow(entry.tab, fresh.rowNumber, { ...fresh.row, outlet_id: targetId, updated_at: now });
      await logAudit({
        actorUserId: 'script', actorRole: 'system', action: 'master_data:reassign',
        entity: entry.tab === TABS.employees ? 'employee' : 'user', entityId,
        beforeValue: entry.row.outlet_id, afterValue: targetId
      });
    }
  }
  const stillBlocked = references.filter((r) => !reassign.has(r.id));
  if (stillBlocked.length) throw new Error('Unresolved references after reassignment; aborting deactivation');

  // (3) Deactivate dummy outlets.
  for (const operation of plan) {
    if (operation.action !== 'DEACTIVATE') continue;
    const found = await findRow(TABS.outlets, 'outlet_id', operation.id);
    if (!found) throw new Error(`Outlet disappeared: ${operation.id}`);
    const updated = { ...found.row, status: 'inactive', updated_at: now };
    await updateRow(TABS.outlets, found.rowNumber, updated);
    await logAudit({
      actorUserId: 'script', actorRole: 'system', action: 'master_data:deactivate',
      entity: 'outlet', entityId: operation.id,
      beforeValue: JSON.stringify(found.row), afterValue: JSON.stringify(updated)
    });
  }
  for (const { employee, normalized } of statusPlan) {
    if (!normalized || normalized === employee.employment_status) continue;
    const found = await findRow(TABS.employees, 'employee_id', employee.employee_id);
    if (!found || found.row.employment_status !== employee.employment_status) throw new Error(`Employee status changed: ${employee.employee_id}`);
    await updateRow(TABS.employees, found.rowNumber, { ...found.row, employment_status: normalized, updated_at: now });
    await logAudit({
      actorUserId: 'script', actorRole: 'system', action: 'master_data:rename',
      entity: 'employee', entityId: employee.employee_id,
      beforeValue: employee.employment_status, afterValue: normalized
    });
  }
  const remaining = planOutletMigration(await readTab<OutletMigrationRow>(TABS.outlets), brands);
  if (remaining.some((operation) => operation.action !== 'KEEP')) throw new Error('Post-migration outlet verification failed; rerun dry-run');
  // End-state reference verification: every ACTIVE employee/user row must
  // point at one of the four active outlets (covers duplicate rows too).
  const endEmployees = await readTab<Record<string, string>>(TABS.employees);
  const endUsers = await readTab<Record<string, string>>(TABS.users);
  const stray = [...endEmployees, ...endUsers].filter((r) =>
    r.outlet_id && !finallyActiveIds.has(r.outlet_id) && ['active', '1'].includes(r.active_status)
  );
  if (stray.length) {
    console.log('\n!!! STRAY REFERENCES (still pointing at inactive outlet):');
    for (const r of stray) console.log(`    ${r.employee_id || r.user_id} → ${r.outlet_id}`);
    console.log('Fix: add --reassign-<id>=<active-OL-id> and re-run.');
    process.exitCode = 1;
    return;
  }
  console.log('Verified: four active outlets, all active employee/user rows point at them; historic rows + GPS coordinates preserved.');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
