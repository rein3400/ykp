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
  const deactivatedIds = new Set(plan.filter((p) => p.action === 'DEACTIVATE').map((p) => p.id));
  const activatingIds = new Set(plan.filter((p) => p.action !== 'DEACTIVATE').map((p) => p.id));
  const activeEntityIds = new Set(
    [...employees, ...users].filter((r) => ['active', '1'].includes(r.active_status)).map((r) => r.employee_id || r.user_id)
  );
  const entityById = new Map<string, { tab: typeof TABS.employees | typeof TABS.users; row: Record<string, string> }>();
  for (const e of employees) if (e.employee_id) entityById.set(e.employee_id, { tab: TABS.employees, row: e });
  for (const u of users) if (u.user_id) entityById.set(u.user_id, { tab: TABS.users, row: u });
  const references = [...employees, ...users].filter((r) =>
    deactivatedIds.has(r.outlet_id) && ['active', '1'].includes(r.active_status)
  );
  // Validate reassign mapping against the live plan.
  for (const [entityId, targetId] of reassign) {
    if (!activeEntityIds.has(entityId)) throw new Error(`--reassign: "${entityId}" is not an active employee/user id`);
    if (!entityById.has(entityId) || !deactivatedIds.has(entityById.get(entityId)!.row.outlet_id)) {
      throw new Error(`--reassign: "${entityId}" does not currently reference a deactivated outlet`);
    }
    if (!activatingIds.has(targetId)) throw new Error(`--reassign: target "${targetId}" is not active in this migration plan`);
  }
  const uncovered = references.filter((r) => {
    const id = (r.employee_id || r.user_id);
    return !reassign.has(id);
  });
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
    const id = reference.employee_id || reference.user_id;
    const target = reassign.get(id);
    console.log(target ? `REASSIGN ${id} ${reference.outlet_id} → ${target}` : `BLOCKING REFERENCE: ${id} ${reference.outlet_id}`);
  }
  for (const entityId of reassign.keys()) {
    if (!references.some((r) => (r.employee_id || r.user_id) === entityId)) {
      console.log(`IGNORED --reassign ${entityId}: no longer blocked`);
    }
  }
  if (!apply) return;
  if (uncovered.length) {
    throw new Error(
      'Active employees/users reference outlets to deactivate. Pass --reassign-<ENTITY_ID>=<OL-XXX> for: '
      + uncovered.map((r) => `--reassign-${r.employee_id || r.user_id}=<active-OL-id>`).join(' ')
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

  // (2) Reassign active references off condemned outlets, then deactivate safely.
  for (const [entityId, targetId] of reassign) {
    const entity = entityById.get(entityId)!;
    if (entity.row.outlet_id === targetId) continue;
    const keyCol = entity.tab === TABS.employees ? 'employee_id' : 'user_id';
    const found = await findRow(entity.tab, keyCol, entityId);
    if (!found || found.row.outlet_id !== entity.row.outlet_id) throw new Error(`Reference changed since plan: ${entityId}`);
    await updateRow(entity.tab, found.rowNumber, { ...found.row, outlet_id: targetId, updated_at: now });
    await logAudit({
      actorUserId: 'script', actorRole: 'system', action: 'master_data:reassign',
      entity: entity.tab === TABS.employees ? 'employee' : 'user', entityId,
      beforeValue: entity.row.outlet_id, afterValue: targetId
    });
  }
  const stillBlocked = references.filter((r) => {
    const id = (r.employee_id || r.user_id);
    return !reassign.has(id);
  });
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
  console.log('Verified: four active outlets; historic rows preserved. GPS coordinates were not changed.');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
