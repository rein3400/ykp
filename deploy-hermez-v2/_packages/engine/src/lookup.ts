/**
 * @ykp/engine/lookup
 *
 * Cross-DB name resolution helpers. Replace the mock-api-ykp.ts helpers
 * that were scattered across the demo app. All async; return null when
 * the referenced id is missing (instead of throwing) so callers can
 * decide whether missing master data is a schema_mismatch alert.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  masterBrand,
  masterOutlet,
  masterEmployee,
  masterSupplier,
  hrRules,
  type HrRules,
} from "../../schema/src/index";

type AnyDb = PostgresJsDatabase<Record<string, unknown>>;

export async function getOutletName(masterDb: AnyDb, outlet_id: string): Promise<string | null> {
  const rows = await masterDb
    .select({ name: masterOutlet.outletName })
    .from(masterOutlet)
    .where(eq(masterOutlet.outletId, outlet_id))
    .limit(1);
  return rows[0]?.name ?? null;
}

export async function getSupplierName(masterDb: AnyDb, supplier_id: string): Promise<string | null> {
  const rows = await masterDb
    .select({ name: masterSupplier.supplierName })
    .from(masterSupplier)
    .where(eq(masterSupplier.supplierId, supplier_id))
    .limit(1);
  return rows[0]?.name ?? null;
}

export async function getBrandName(masterDb: AnyDb, brand_id: string): Promise<string | null> {
  const rows = await masterDb
    .select({ name: masterBrand.brandName })
    .from(masterBrand)
    .where(eq(masterBrand.brandId, brand_id))
    .limit(1);
  return rows[0]?.name ?? null;
}

export async function getEmployeeName(masterDb: AnyDb, employee_id: string): Promise<string | null> {
  const rows = await masterDb
    .select({ name: masterEmployee.fullName })
    .from(masterEmployee)
    .where(eq(masterEmployee.employeeId, employee_id))
    .limit(1);
  return rows[0]?.name ?? null;
}

/**
 * Defect H1 fix: hr_rules lives in ykp_master (it migrates there per
 * master.ts), but HR routes were reading it via ykp_hr — which never has the
 * rows. Centralise the master-side read here so every callsite resolves
 * against the correct DB. Optional `shiftName` selects the matching shift
 * when multiple rules exist for the outlet.
 */
export async function getHrRulesForOutlet(
  masterDb: AnyDb,
  outletId: string,
  shiftName?: string,
): Promise<HrRules | null> {
  const rows = await masterDb
    .select()
    .from(hrRules)
    .where(eq(hrRules.outletId, outletId))
    .limit(5);
  if (!rows.length) return null;
  if (shiftName) {
    return rows.find((r) => r.shiftName === shiftName) ?? rows[0];
  }
  return rows[0];
}