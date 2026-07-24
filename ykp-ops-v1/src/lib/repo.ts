/**
 * Sequential IDs + FK asserts for Operational V1.
 */
import { findRow, readTab, TABS } from '@/db/sheets';

// Counter is kept on globalThis via Symbol.for so it is shared across every
// module graph in the dev server. A module-local `const` would reset when
// Turbopack re-evaluates the module, producing duplicate IDs.
const COUNTER_SYMBOL = Symbol.for('ykpOpsCounters');

function getCounters(): Record<string, number> {
  const g = globalThis as unknown as Record<symbol, Record<string, number> | undefined>;
  if (!g[COUNTER_SYMBOL]) g[COUNTER_SYMBOL] = {};
  return g[COUNTER_SYMBOL] as Record<string, number>;
}

export function nextSequentialIdSync(prefix: string): string {
  const key = prefix.toUpperCase();
  const counters = getCounters();
  counters[key] = (counters[key] ?? 0) + 1;
  const n = counters[key];
  if (key === 'EMP') return `${key}-${String(n).padStart(5, '0')}`;
  if (key === 'SUM' || key === 'OPS') {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `OPS-${d}-${String(n).padStart(3, '0')}`;
  }
  return `${key}-${String(n).padStart(3, '0')}`;
}

export class MissingRefError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'MissingRefError';
  }
}

export async function assertBrand(id: string): Promise<void> {
  const r = await findRow(TABS.brands, 'brand_id', id);
  if (!r) throw new MissingRefError('brand', id);
}

export async function assertOutlet(id: string): Promise<void> {
  const r = await findRow(TABS.outlets, 'outlet_id', id);
  if (!r) throw new MissingRefError('outlet', id);
}

export async function assertEmployee(id: string): Promise<void> {
  const r = await findRow(TABS.employees, 'employee_id', id);
  if (!r) throw new MissingRefError('employee', id);
}

export async function assertShift(id: string): Promise<void> {
  const r = await findRow(TABS.shifts, 'shift_id', id);
  if (!r) throw new MissingRefError('shift', id);
}

export async function getBrandName(id: string): Promise<string> {
  const r = await findRow(TABS.brands, 'brand_id', id);
  return r?.row.brand_name ?? id;
}

export async function getOutletName(id: string): Promise<string> {
  const r = await findRow(TABS.outlets, 'outlet_id', id);
  return r?.row.outlet_name ?? id;
}

export async function listActiveOutlets(): Promise<Record<string, string>[]> {
  const rows = await readTab(TABS.outlets);
  return rows.filter((r) => (r.status || 'active').toLowerCase() === 'active');
}
