/**
 * @ykp/auth/scope
 *
 * Applies RBAC scope filter to Drizzle query conditions for OUTLET_MANAGER
 * (and other scoped) roles. Owner / Super Admin / Finance Admin / Hr Admin
 * are unscoped and pass through unchanged.
 *
 * Defect 9 fix: previously GET routes returned all rows regardless of the
 * caller's brand/outlet scope. Now scopes are enforced server-side.
 *
 * Usage:
 *   const conds = [gte(table.date, from), lte(table.date, to)];
 *   applyOutletScope(user, conds, table.outletId);
 *   db.select(...).from(table).where(and(...conds));
 */
import { SQL, inArray } from "drizzle-orm";
import { type SQLWrapper } from "drizzle-orm";
import { type SessionUser } from './rbac';
import { Role } from './roles';

/**
 * Push an outlet-scope filter onto `conds` for users whose role is bound to
 * specific outlets. Owner / Super Admin / Hr Admin / Finance Admin pass through.
 */
export function applyOutletScope<T>(
  user: SessionUser,
  conds: Array<SQLWrapper | SQL<T> | undefined>,
  outletColumn: SQLWrapper,
): void {
  if (
    user.role === Role.OWNER ||
    user.role === Role.SUPER_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.FINANCE_ADMIN
  ) {
    return;
  }
  if (user.role === Role.OUTLET_MANAGER) {
    // Note: OperationalRole.SUPERVISOR is not in the session Role enum; session
    // role never resolves to SUPERVISOR, so we don't gate on it here.
    if (user.outletIds && user.outletIds.length > 0) {
      conds.push(inArray(outletColumn as never, user.outletIds as string[]));
    } else {
      // Scoped role with no assigned outlets: deny by impossible id.
      conds.push(inArray(outletColumn as never, ["__none__"]));
    }
  }
  // BRAND_MANAGER brand-level filter deferred: tables lack brandId column.
  // Documented as V2 known limitation (cross-DB subquery against master.outlet).
}