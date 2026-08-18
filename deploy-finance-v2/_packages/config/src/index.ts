/**
 * @ykp/config
 * Shared configuration constants used across YKP ERP apps.
 */

/** Canonical timezone for all YKP ERP business dates. */
export const TZ = "Asia/Jakarta" as const;

/** Hermez daily brief generation hour in UTC (15:00 UTC = 22:00 WIB). */
export const HERMEZ_RUN_HOUR_UTC = 15;

/** Standard role codes for YKP ERP applications. */
export enum Role {
  /** Full platform access. */
  OWNER = "OWNER",
  /** Cross-brand admin, cannot delete owners. */
  SUPER_ADMIN = "SUPER_ADMIN",
  /** Finance app administrator. */
  FINANCE_ADMIN = "FINANCE_ADMIN",
  /** HR app administrator. */
  HR_ADMIN = "HR_ADMIN",
  /** Brand-level manager across outlets. */
  BRAND_MANAGER = "BRAND_MANAGER",
  /** Outlet-level manager. */
  OUTLET_MANAGER = "OUTLET_MANAGER",
  /** Data entry clerk. */
  STAFF_INPUT = "STAFF_INPUT",
  /** Read-only dashboard access. */
  VIEWER = "VIEWER",
}

/** Operational role codes for the future operational app. */
export enum OperationalRole {
  OPERATIONAL_ADMIN = "OPERATIONAL_ADMIN",
  SUPERVISOR = "SUPERVISOR",
  KITCHEN_LEAD = "KITCHEN_LEAD",
  CASHIER = "CASHIER",
  FOH = "FOH",
  STAFF = "STAFF",
}

/** ID prefixes used by engine id-gen helpers. */
export const ID_PREFIXES = {
  brand: "BR",
  outlet: "OL",
  employee: "EMP",
  supplier: "SUP",
  hrDailySummary: "HRR",
  financeDailySummary: "FIN",
  hermezBrief: "HZBR",
  hermezAlert: "HZAL",
} as const;

/** Re-export the package version for diagnostics. */
export const CONFIG_VERSION = "0.1.0";
