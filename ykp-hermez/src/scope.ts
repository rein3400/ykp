/**
 * Row-level scope filtering for Hermez chat answers.
 *
 * Every data tool returns rows that carry brand_id/outlet_id (or a nested
 * per_outlet/per-item shape). Before the LLM sees them, we filter to the
 * caller's scope so a department head never reads another brand/outlet's
 * numbers. Owner/super_admin/hr_admin/finance_admin have an empty scope and
 * see everything.
 */
import type { Scope } from './actor.js';

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Top-level scope match: a row's own outlet_id/brand_id must equal the
 *  scope when set. A row lacking the id is dropped at the top level (it
 *  carries no inheritable parent scope here). */
function matches(row: Row, scope: Scope): boolean {
  if (scope.outletId) return str(row.outlet_id) === scope.outletId;
  if (scope.brandId) return str(row.brand_id) === scope.brandId;
  return true;
}

/** Recursively verify nested array members stay in scope. A nested member
 *  that carries its own outlet_id/brand_id must match the scope; one without
 *  an id inherits its parent's scope. If ANY nested member is out-of-scope
 *  the whole group is rejected, so a grouped/unflattened tool result cannot
 *  leak cross-outlet rows past the top-level check. */
function nestedInScope(row: Row, scope: Scope): boolean {
  if (scope.outletId && 'outlet_id' in row && str(row.outlet_id) !== scope.outletId) return false;
  if (scope.brandId && 'brand_id' in row && str(row.brand_id) !== scope.brandId) return false;
  for (const v of Object.values(row)) {
    if (Array.isArray(v)) {
      for (const m of v) {
        if (m && typeof m === 'object' && !nestedInScope(m as Row, scope)) return false;
      }
    }
  }
  return true;
}

function inScope(row: Row, scope: Scope): boolean {
  return matches(row, scope) && nestedInScope(row, scope);
}

function filter<T extends Row>(rows: T[], scope: Scope): T[] {
  if (!scope.brandId && !scope.outletId) return rows;
  return rows.filter((r) => inScope(r, scope));
}

/** Filter a flat (or nested/grouped) list of rows by brand/outlet scope. */
export function filterRows<T extends Row>(rows: T[], scope: Scope): T[] {
  return filter(rows, scope);
}

/** Filter rows nested under a `per_outlet` key (recurse into nested groups). */
export function filterPerOutlet<T extends Row>(rows: T[], scope: Scope): T[] {
  return filter(rows, scope);
}

/** Filter rows nested under an `items` key (recurse into nested groups). */
export function filterItems<T extends Row>(rows: T[], scope: Scope): T[] {
  return filter(rows, scope);
}
