/**
 * Cross-DB reference validation helpers. Postgres cannot enforce FKs
 * across the four logical databases, so every finance insert that
 * references a master row (outlet, brand, supplier, account, category,
 * payment method, employee) must be validated here BEFORE the insert.
 *
 * On mismatch the route handler returns HTTP 400 missing_ref so the
 * caller can surface "reference not found" cleanly.
 */
import { eq } from "drizzle-orm";
import type { MasterDb } from "./db.js";
import {
  masterBrand,
  masterOutlet,
  masterSupplier,
  masterEmployee,
  finPettyCashAccount,
  finExpenseCategory,
  finPaymentMethod,
} from "@ykp/schema";

export class MissingRefError extends Error {
  constructor(
    public readonly ref: string,
    public readonly id: string,
  ) {
    super(`Reference not found: ${ref}=${id}`);
    this.name = "MissingRefError";
  }
}

export async function assertOutlet(masterDb: MasterDb, outletId: string): Promise<{ brandId: string; outletName: string }> {
  const rows = await masterDb
    .select({ outletId: masterOutlet.outletId, brandId: masterOutlet.brandId, outletName: masterOutlet.outletName })
    .from(masterOutlet)
    .where(eq(masterOutlet.outletId, outletId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("outlet_id", outletId);
  return { brandId: rows[0].brandId, outletName: rows[0].outletName };
}

export async function assertBrand(masterDb: MasterDb, brandId: string): Promise<string> {
  const rows = await masterDb
    .select({ brandId: masterBrand.brandId, brandName: masterBrand.brandName })
    .from(masterBrand)
    .where(eq(masterBrand.brandId, brandId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("brand_id", brandId);
  return rows[0].brandName;
}

export async function assertSupplier(masterDb: MasterDb, supplierId: string): Promise<string> {
  const rows = await masterDb
    .select({ supplierId: masterSupplier.supplierId, supplierName: masterSupplier.supplierName })
    .from(masterSupplier)
    .where(eq(masterSupplier.supplierId, supplierId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("supplier_id", supplierId);
  return rows[0].supplierName;
}

export async function assertEmployee(masterDb: MasterDb, employeeId: string): Promise<string> {
  const rows = await masterDb
    .select({ employeeId: masterEmployee.employeeId, fullName: masterEmployee.fullName })
    .from(masterEmployee)
    .where(eq(masterEmployee.employeeId, employeeId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("employee_id", employeeId);
  return rows[0].fullName;
}

export async function assertPettyCashAccount(masterDb: MasterDb, accountId: string): Promise<{ outletId: string; accountName: string }> {
  const rows = await masterDb
    .select({ accountId: finPettyCashAccount.accountId, outletId: finPettyCashAccount.outletId, accountName: finPettyCashAccount.accountName })
    .from(finPettyCashAccount)
    .where(eq(finPettyCashAccount.accountId, accountId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("account_id", accountId);
  return { outletId: rows[0].outletId, accountName: rows[0].accountName };
}

export async function assertExpenseCategory(masterDb: MasterDb, categoryId: string): Promise<string> {
  const rows = await masterDb
    .select({ categoryId: finExpenseCategory.categoryId, categoryName: finExpenseCategory.categoryName })
    .from(finExpenseCategory)
    .where(eq(finExpenseCategory.categoryId, categoryId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("category_id", categoryId);
  return rows[0].categoryName;
}

export async function assertPaymentMethod(masterDb: MasterDb, methodId: string): Promise<string> {
  const rows = await masterDb
    .select({ methodId: finPaymentMethod.methodId, methodName: finPaymentMethod.methodName })
    .from(finPaymentMethod)
    .where(eq(finPaymentMethod.methodId, methodId))
    .limit(1);
  if (!rows[0]) throw new MissingRefError("payment_method_id", methodId);
  return rows[0].methodName;
}