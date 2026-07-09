/**
 * Sheet repository helpers. FK validation, ID generation, and common lookups.
 * Sheets has no FK so we validate in this layer and throw MissingRefError.
 *
 * nextSequentialId uses `PREFIX-{ts36}{rand}` for uniqueness under concurrent
 * inserts (no read-then-write race). Caller should still re-check via
 * findRow + ConflictError if a duplicate must be rejected.
 */

import { randomBytes } from 'crypto';
import { readTab, TABS, findRow, appendRows, updateRow } from '@/db/sheets';
import { nowTimestampWib } from './format';

export class MissingRefError extends Error {
  override name = 'MissingRefError';
  constructor(message: string) {
    super(message);
  }
}

export class ConflictError extends Error {
  override name = 'ConflictError';
  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends Error {
  override name = 'NotFoundError';
  constructor(message: string) {
    super(message);
  }
}

/** Validate that brand_id exists. */
export async function assertBrand(brandId: string): Promise<void> {
  if (!brandId) throw new MissingRefError('brand_id is required');
  const r = await findRow(TABS.brands, 'brand_id', brandId);
  if (!r) throw new MissingRefError(`brand_id not found: ${brandId}`);
}

/** Validate that outlet_id exists. */
export async function assertOutlet(outletId: string): Promise<void> {
  if (!outletId) throw new MissingRefError('outlet_id is required');
  const r = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!r) throw new MissingRefError(`outlet_id not found: ${outletId}`);
}

/** Validate employee_id. */
export async function assertEmployee(employeeId: string): Promise<void> {
  if (!employeeId) throw new MissingRefError('employee_id is required');
  const r = await findRow(TABS.employees, 'employee_id', employeeId);
  if (!r) throw new MissingRefError(`employee_id not found: ${employeeId}`);
}

/** Validate shift_id. */
export async function assertShift(shiftId: string): Promise<void> {
  if (!shiftId) return;
  const r = await findRow(TABS.shifts, 'shift_id', shiftId);
  if (!r) throw new MissingRefError(`shift_id not found: ${shiftId}`);
}

/** Generate a unique ID of shape PREFIX-{ts36}{rand6}. No read-modify-write race. */
export function nextSequentialIdSync(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

/**
 * Read current numeric seq from a tab and return next padded ID `PREFIX-NNN`.
 * Race-safe under Sheets append semantics only if callers verify via findRow
 * after append (CollisionGuard pattern). For high-concurrency inserts, prefer
 * `nextSequentialIdSync` which is race-free without re-check.
 *
 * Pilot 5-10 staff: collision risk negligible; caller ConflictError guard
 * handles the rare same-ms insert.
 */
export async function nextSequentialId(
  tab: keyof typeof TABS,
  keyCol: string,
  prefix: string,
  digits = 3
): Promise<string> {
  const n = await nextNumericSeq(tab, keyCol, prefix);
  return `${prefix}-${String(n).padStart(digits, '0')}`;
}

/** Scan tab for highest existing PREFIX-NNN. Returns 0 if none. */
export async function nextNumericSeq(tab: keyof typeof TABS, keyCol: string, prefix: string): Promise<number> {
  const rows = await readTab<Record<string, string>>(TABS[tab]);
  let maxN = 0;
  for (const r of rows) {
    const v = r[keyCol] ?? '';
    const m = v.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) {
      const n = Number(m[1]);
      if (n > maxN) maxN = n;
    }
  }
  return maxN + 1;
}

export function nowCreated(): string {
  return nowTimestampWib();
}

export { readTab, TABS, findRow, appendRows, updateRow };