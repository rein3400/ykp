/**
 * @ykp/auth/rbac
 *
 * Role-based access control matrix aligned with binding contract §6.
 * `can(role, resource, action)` is the single source of truth used by
 * route handlers, server actions, and UI guards.
 *
 * Clerk replacement note: `getCurrentUser()` currently reads a stub
 * session cookie. When Clerk is wired in, only this function needs to
 * change — every callsite already depends on the SessionUser shape.
 */

import { Role } from './roles';
import { getSession } from './session';

/** Logical resources guarded by RBAC. Stable identifiers, not display labels. */
export type Resource =
  | "user"
  | "brand"
  | "outlet"
  | "employee"
  | "supplier"
  | "attendance"
  | "payroll"
  | "expense"
  | "petty_cash"
  | "pos"
  | "closing"
  | "moka_import"
  | "approval"
  | "brief"
  | "alert"
  | "audit"
  | "report";

/** Actions that can be performed against a resource. */
export type Action = "read" | "create" | "update" | "delete" | "approve" | "import" | "export";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  brandIds?: ReadonlyArray<string>;
  outletIds?: ReadonlyArray<string>;
}

/**
 * RBAC matrix. Keys are `${Role}|${Resource}`; values are sets of allowed actions.
 * Owner is wildcarded below to avoid duplicating every cell.
 */
const RBAC_MATRIX: ReadonlyMap<string, ReadonlyArray<Action>> = new Map<string, ReadonlyArray<Action>>([
  // SUPER_ADMIN: same as Owner for most resources, but no user delete (use OWNER for that)
  [`${Role.SUPER_ADMIN}|user`, ["read", "create", "update"]],
  [`${Role.SUPER_ADMIN}|brand`, ["read", "create", "update", "delete"]],
  [`${Role.SUPER_ADMIN}|outlet`, ["read", "create", "update", "delete"]],
  [`${Role.SUPER_ADMIN}|employee`, ["read", "create", "update", "delete"]],
  [`${Role.SUPER_ADMIN}|supplier`, ["read", "create", "update", "delete"]],
  [`${Role.SUPER_ADMIN}|attendance`, ["read", "create", "update", "export"]],
  [`${Role.SUPER_ADMIN}|payroll`, ["read", "approve", "export"]],
  [`${Role.SUPER_ADMIN}|expense`, ["read", "create", "update", "approve", "export"]],
  [`${Role.SUPER_ADMIN}|petty_cash`, ["read", "create", "update", "approve", "export"]],
  [`${Role.SUPER_ADMIN}|closing`, ["read", "update", "approve"]],
  [`${Role.SUPER_ADMIN}|moka_import`, ["read", "import"]],
  [`${Role.SUPER_ADMIN}|approval`, ["read", "approve"]],
  [`${Role.SUPER_ADMIN}|brief`, ["read"]],
  [`${Role.SUPER_ADMIN}|alert`, ["read", "update"]],
  [`${Role.SUPER_ADMIN}|audit`, ["read", "export"]],
  [`${Role.SUPER_ADMIN}|report`, ["read", "export"]],

  // FINANCE_ADMIN
  [`${Role.FINANCE_ADMIN}|brand`, ["read"]],
  [`${Role.FINANCE_ADMIN}|outlet`, ["read"]],
  [`${Role.FINANCE_ADMIN}|supplier`, ["read", "create", "update"]],
  [`${Role.FINANCE_ADMIN}|expense`, ["read", "create", "update", "approve", "export"]],
  [`${Role.FINANCE_ADMIN}|petty_cash`, ["read", "create", "update", "approve", "export"]],
  [`${Role.FINANCE_ADMIN}|pos`, ["read", "create", "update"]],
  [`${Role.FINANCE_ADMIN}|closing`, ["read", "update", "approve"]],
  [`${Role.FINANCE_ADMIN}|moka_import`, ["read", "import"]],
  [`${Role.FINANCE_ADMIN}|approval`, ["read", "approve"]],
  [`${Role.FINANCE_ADMIN}|brief`, ["read"]],
  [`${Role.FINANCE_ADMIN}|audit`, ["read", "export"]],
  [`${Role.FINANCE_ADMIN}|report`, ["read", "export"]],

  // HR_ADMIN
  [`${Role.HR_ADMIN}|brand`, ["read"]],
  [`${Role.HR_ADMIN}|outlet`, ["read"]],
  [`${Role.HR_ADMIN}|employee`, ["read", "create", "update"]],
  [`${Role.HR_ADMIN}|attendance`, ["read", "create", "update", "export"]],
  [`${Role.HR_ADMIN}|payroll`, ["read", "approve", "export"]],
  [`${Role.HR_ADMIN}|approval`, ["read", "approve"]],
  [`${Role.HR_ADMIN}|brief`, ["read"]],
  [`${Role.HR_ADMIN}|audit`, ["read"]],
  [`${Role.HR_ADMIN}|report`, ["read", "export"]],

  // BRAND_MANAGER
  [`${Role.BRAND_MANAGER}|brand`, ["read"]],
  [`${Role.BRAND_MANAGER}|outlet`, ["read"]],
  [`${Role.BRAND_MANAGER}|employee`, ["read"]],
  [`${Role.BRAND_MANAGER}|attendance`, ["read", "export"]],
  [`${Role.BRAND_MANAGER}|payroll`, ["read", "export"]],
  [`${Role.BRAND_MANAGER}|expense`, ["read", "export"]],
  [`${Role.BRAND_MANAGER}|brief`, ["read"]],
  [`${Role.BRAND_MANAGER}|alert`, ["read", "update"]],
  [`${Role.BRAND_MANAGER}|report`, ["read", "export"]],

  // OUTLET_MANAGER
  [`${Role.OUTLET_MANAGER}|brand`, ["read"]],
  [`${Role.OUTLET_MANAGER}|outlet`, ["read"]],
  [`${Role.OUTLET_MANAGER}|employee`, ["read"]],
  [`${Role.OUTLET_MANAGER}|attendance`, ["read", "create", "update"]],
  [`${Role.OUTLET_MANAGER}|expense`, ["read", "create", "update"]],
  [`${Role.OUTLET_MANAGER}|petty_cash`, ["read", "create", "update"]],
  [`${Role.OUTLET_MANAGER}|pos`, ["read", "create", "update"]],
  [`${Role.OUTLET_MANAGER}|closing`, ["read", "update"]],
  [`${Role.OUTLET_MANAGER}|moka_import`, ["read", "import"]],
  [`${Role.OUTLET_MANAGER}|brief`, ["read"]],
  [`${Role.OUTLET_MANAGER}|alert`, ["read", "update"]],

  // STAFF_INPUT
  [`${Role.STAFF_INPUT}|attendance`, ["create", "update"]],
  [`${Role.STAFF_INPUT}|expense`, ["create"]],
  [`${Role.STAFF_INPUT}|petty_cash`, ["create"]],

  // VIEWER
  [`${Role.VIEWER}|brand`, ["read"]],
  [`${Role.VIEWER}|outlet`, ["read"]],
  [`${Role.VIEWER}|brief`, ["read"]],
  [`${Role.VIEWER}|report`, ["read"]],
]);

/**
 * Owner bypasses the matrix — single source of truth for "full access".
 * Keep this as the only Role that resolves true for *every* action;
 * other roles should be explicit so reviewers can audit the matrix.
 */
export function can(role: Role, resource: Resource, action: Action): boolean {
  if (role === Role.OWNER) return true;
  const allowed = RBAC_MATRIX.get(`${role}|${resource}`);
  return Boolean(allowed?.includes(action));
}

/**
 * User retrieval. Reads the ykp_session cookie and verifies the HS256
 * signature via getSession()/verifySession() before parsing. The
 * client-side path returns null (sessions are server-only). Replace
 * with Clerk by swapping getSession — every consumer depends on the
 * return shape.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (typeof window !== "undefined") return null;
  const { user } = await getSession();
  return user;
}

/**
 * Helper for Next.js route handlers / server actions. Throws if the
 * caller does not match any of the allowed roles. Use this at the top
 * of a handler:
 *
 *   export async function POST(req: Request) {
 *     const user = await requireRole([Role.OWNER, Role.HR_ADMIN]);
 *     ...
 *   }
 */
export async function requireRole(allowed: ReadonlyArray<Role>): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !allowed.includes(user.role)) {
    const err = new Error("Forbidden: insufficient role");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return user;
}

/**
 * Require any authenticated user — role-agnostic. Use for read-only
 * endpoints where the only gate is "is there a valid session" (e.g.
 * the Hermez alerts list, which every authenticated role may read).
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return user;
}

/** Resource-level scope check for BRAND_MANAGER / OUTLET_MANAGER. */
export function isInScope(user: SessionUser, resource: Resource, ids: ReadonlyArray<string>): boolean {
  if (user.role === Role.OWNER || user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.BRAND_MANAGER) {
    return user.brandIds?.some((id) => ids.includes(id)) ?? false;
  }
  if (user.role === Role.OUTLET_MANAGER) {
    return user.outletIds?.some((id) => ids.includes(id)) ?? false;
  }
  // For non-scoped roles, scope check always passes (RBAC matrix applies instead).
  void resource;
  return true;
}