/**
 * One-shot master-data migration (client 2026-10: real outlets + canonical statuses).
 *
 * Dry-run by default — prints the plan. Pass --apply to write.
 * MUST run with real Sheets credentials (refuses mock/postgres modes).
 *
 *   npm run sheets:fix-master-data           # plan only
 *   npm run sheets:fix-master-data -- --apply
 */
import { readTab, updateRow, appendRows, findRow, TABS } from '../src/db/sheets';
import { logAudit } from '../src/lib/audit';
import {
  REAL_OUTLETS, normalizeEmploymentStatus, isDummyOutletName,
  CANONICAL_STATUSES, type EmploymentStatus
} from '../src/lib/master-data';

interface OutletRow {
  outlet_id: string;
  outlet_name: string;
  brand_id: string;
  active_status: string;
  latitude?: string;
  longitude?: string;
  attendance_radius_m?: string;
  address?: string;
}
interface EmployeeRow {
  employee_id: string;
  full_name: string;
  employment_status: string;
}

const APPLY = process.argv.includes('--apply');

if (process.env.USE_MOCK_DB === 'true') {
  console.error('REFUSED: USE_MOCK_DB is set — run with real Sheets credentials.');
  process.exit(1);
}

async function main(): Promise<void> {
// ── Plan outlet rows ────────────────────────────────────────────────
const outlets = await readTab<OutletRow>(TABS.outlets);
const byId = new Map(outlets.filter((o) => o.outlet_id).map((o) => [o.outlet_id, o]));
const realIds = new Set(REAL_OUTLETS.map((r) => r.outlet_id));
const nameToId = new Map(outlets.map((o) => [o.outlet_name?.trim().toLowerCase(), o.outlet_id]));
const idSeq = outlets.map((o) => Number(String(o.outlet_id || '').replace(/\D+/g, '')) || 0);
let nextId = Math.max(10, ...idSeq) + 1;

const outletPlan: Array<{ id: string; action: string; detail: string; name?: string; brandId?: string }> = [];
for (const real of REAL_OUTLETS) {
  const existing = byId.get(real.outlet_id)
    ?? byId.get(nameToId.get(real.outlet_name.toLowerCase()) ?? '');
  if (!existing) {
    const assigned = real.outlet_id && !nameToId.get(real.outlet_name.toLowerCase())
      ? real.outlet_id
      : `OL-${String(nextId++).padStart(3, '0')}`;
    outletPlan.push({ id: assigned, action: 'ADD_ACTIVE', name: real.outlet_name, brandId: real.brand_id, detail: `${real.outlet_name} (brand ${real.brand_id})` });
  } else if (existing.outlet_name?.trim() !== real.outlet_name || existing.active_status !== 'active') {
    outletPlan.push({ id: existing.outlet_id, action: 'RENAME_ACTIVATE', name: real.outlet_name, brandId: real.brand_id, detail: `${existing.outlet_name} → ${real.outlet_name}` });
  } else {
    outletPlan.push({ id: existing.outlet_id, action: 'KEEP', detail: `${existing.outlet_name}` });
  }
}
for (const o of outlets) {
  if (!o.outlet_id) continue;
  if (realIds.has(o.outlet_id)) continue;
  if (!realIds.has(o.outlet_id) && o.active_status === 'active') {
    outletPlan.push({ id: o.outlet_id, action: 'DEACTIVATE', detail: `${o.outlet_name}${isDummyOutletName(o.outlet_name ?? '') ? ' (dummy-name)' : ''}` });
  }
}

// ── Plan employee statuses ──────────────────────────────────────────
const employees = await readTab<EmployeeRow>(TABS.employees);
const statusPlan: Array<{ employee_id: string; from: string; to: EmploymentStatus }> = [];
const unknownStatuses: Array<{ employee_id: string; value: string }> = [];
for (const e of employees) {
  const raw = (e.employment_status ?? '').trim();
  if (!raw) continue;
  const norm = normalizeEmploymentStatus(raw);
  if (!norm) {
    unknownStatuses.push({ employee_id: e.employee_id, value: raw });
  } else if (norm !== raw) {
    statusPlan.push({ employee_id: e.employee_id, from: raw, to: norm });
  }
}

// ── Report / act ────────────────────────────────────────────────────
const mode = APPLY ? 'APPLY' : 'PLAN (dry-run; pass --apply to write)';
console.log(`\n=== Master-data fix — ${mode} ===\n`);

console.log('Outlets:');
for (const p of outletPlan) console.log(`  [${p.action}] ${p.id} — ${p.detail}`);
console.log('\nEmployment statuses:');
for (const s of statusPlan) console.log(`  [RENAME] ${s.employee_id}: ${s.from} → ${s.to}`);
if (unknownStatuses.length) {
  console.log('\n  !! Untouched (unknown value — manual review):');
  for (const s of unknownStatuses) console.log(`     ${s.employee_id}: "${s.value}"`);
}
console.log(`\nSummary: ${outletPlan.length} outlet ops, ${statusPlan.length} status renames, ${unknownStatuses.length} unknown left as-is.`);
console.log('Note: latitude/longitude/attendance_radius_m are NOT touched — owner fills real coordinates for bot-GPS.');

if (!APPLY) process.exit(0);

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
for (const p of outletPlan) {
  if (p.action === 'KEEP') continue;
  const rowNo = await findRow(TABS.outlets, 'outlet_id', p.id);
  if (p.action === 'ADD_ACTIVE') {
    await appendRows(TABS.outlets, [{
      outlet_id: p.id,
      brand_id: p.brandId ?? 'BR-001',
      outlet_name: p.name ?? '',
      active_status: 'active',
      created_at: now,
      updated_at: now
    }]);
  } else if (rowNo) {
    const merged = { ...rowNo.row };
    if (p.action === 'DEACTIVATE') merged.active_status = 'inactive';
    if (p.action === 'RENAME_ACTIVATE') {
      merged.outlet_name = p.name ?? merged.outlet_name;
      merged.brand_id = p.brandId ?? merged.brand_id;
      merged.active_status = 'active';
    }
    merged.updated_at = now;
    await updateRow(TABS.outlets, rowNo.rowNumber, merged);
  }
  await logAudit({
    actorUserId: 'script',
    actorRole: 'system',
    action: `master_data:${p.action.toLowerCase()}`,
    entity: 'outlet',
    entityId: p.id,
    afterValue: p.detail
  });
}
for (const s of statusPlan) {
  const rowNo = await findRow(TABS.employees, 'employee_id', s.employee_id);
  if (rowNo) {
    await updateRow(TABS.employees, rowNo.rowNumber, { ...rowNo.row, employment_status: s.to, updated_at: now });
    await logAudit({
      actorUserId: 'script',
      actorRole: 'system',
      action: 'master_data:rename',
      entity: 'employee',
      entityId: s.employee_id,
      beforeValue: s.from,
      afterValue: s.to
    });
  }
}
if (unknownStatuses.length) {
  console.log('\n!!! Rows left untouched (fix manually):');
  for (const s of unknownStatuses) console.log(`    ${s.employee_id}: "${s.value}"  (allowed: ${CANONICAL_STATUSES.join(' | ')})`);
}
console.log('\nDone. Verify in the HR dashboard:');
console.log('  - /hr/absensi outlet filter: only 4 real outlets');
console.log('  - /hr/employees Status Kerja column: Probation / Permanent / Contract only\n');
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
