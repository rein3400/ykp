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
  const [outlets, brands, employees, users] = await Promise.all([
    readTab<OutletMigrationRow>(TABS.outlets),
    readTab<{ brand_id: string; brand_name: string }>(TABS.brands),
    readTab<Record<string, string>>(TABS.employees),
    readTab<Record<string, string>>(TABS.users)
  ]);
  const plan = planOutletMigration(outlets, brands);
  const deactivatedIds = new Set(plan.filter((p) => p.action === 'DEACTIVATE').map((p) => p.id));
  const references = [...employees, ...users].filter((r) =>
    deactivatedIds.has(r.outlet_id) && ['active', '1'].includes(r.active_status)
  );
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
  for (const reference of references) console.log('BLOCKING REFERENCE:', reference.employee_id || reference.user_id, reference.outlet_id);
  if (!apply) return;
  if (references.length) throw new Error('Active employees/users reference outlets to deactivate. Reconcile assignments before apply.');

  const currentOutlets = await readTab<OutletMigrationRow>(TABS.outlets);
  if (JSON.stringify(currentOutlets) !== JSON.stringify(outlets)) throw new Error('Outlet data changed since planning; rerun dry-run');
  const now = nowTimestampWib();
  for (const operation of plan) {
    if (operation.action === 'KEEP') continue;
    const found = await findRow(TABS.outlets, 'outlet_id', operation.id);
    if (operation.action === 'ADD_ACTIVE' && found) throw new Error(`Outlet ID now occupied: ${operation.id}`);
    if (operation.action !== 'ADD_ACTIVE' && !found) throw new Error(`Outlet disappeared: ${operation.id}`);
    const updated = {
      ...found?.row,
      outlet_id: operation.id,
      outlet_name: operation.name,
      brand_id: operation.brandId,
      status: operation.action === 'DEACTIVATE' ? 'inactive' : 'active',
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
