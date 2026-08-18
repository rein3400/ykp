/**
 * @ykp/auth/roles
 *
 * Centralized role definitions for YKP ERP. Two namespaces:
 *  - `Role` — administrative roles for HR, Finance, Hermez dashboards.
 *  - `OperationalRole` — floor/operational roles for the future ops app.
 *
 * String values are stable and persisted to the database; do not rename
 * without a migration.
 */

export enum Role {
  OWNER = "OWNER",
  SUPER_ADMIN = "SUPER_ADMIN",
  FINANCE_ADMIN = "FINANCE_ADMIN",
  HR_ADMIN = "HR_ADMIN",
  BRAND_MANAGER = "BRAND_MANAGER",
  OUTLET_MANAGER = "OUTLET_MANAGER",
  STAFF_INPUT = "STAFF_INPUT",
  VIEWER = "VIEWER",
}

export enum OperationalRole {
  OPERATIONAL_ADMIN = "OPERATIONAL_ADMIN",
  SUPERVISOR = "SUPERVISOR",
  KITCHEN_LEAD = "KITCHEN_LEAD",
  CASHIER = "CASHIER",
  FOH = "FOH",
  STAFF = "STAFF",
}

export const ALL_ADMIN_ROLES: ReadonlyArray<Role> = Object.values(Role);

/** Type-safe helper to assert a string is a known Role. */
export function isRole(value: string): value is Role {
  return (ALL_ADMIN_ROLES as readonly string[]).includes(value);
}

export function isOperationalRole(value: string): value is OperationalRole {
  return (Object.values(OperationalRole) as readonly string[]).includes(value);
}