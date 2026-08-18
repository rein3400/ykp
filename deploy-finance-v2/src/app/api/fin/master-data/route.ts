/**
 * GET /api/fin/master-data?kind=brands|outlets|suppliers|categories|payment_methods|petty_cash_accounts
 *
 * Read-only master data viewer used by the Settings page. Reads from
 * the master DB only; no writes are routed through this finance app
 * (per Hermez boundary, master writes happen in the master app).
 */
import { eq } from "drizzle-orm";
import { Role } from "../../../../../_packages/config/src";
import { requireRole } from "../../../../../_packages/auth/src";
import {
  masterBrand,
  masterOutlet,
  masterSupplier,
  finExpenseCategory,
  finPaymentMethod,
  finPettyCashAccount,
} from "../../../../../_packages/schema/src";
import { getMasterDb } from "../../../../lib/server/db";
import { handler, ok, fail } from "../../../../lib/server/http";
import { FinMasterQuerySchema } from "../../../../lib/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  void user;
  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinMasterQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const db = getMasterDb();
  switch (parsed.data.kind) {
    case "brands":
      return ok(await db.select().from(masterBrand));
    case "outlets":
      return ok(await db.select().from(masterOutlet));
    case "suppliers":
      return ok(await db.select().from(masterSupplier));
    case "categories":
      return ok(await db.select().from(finExpenseCategory).where(eq(finExpenseCategory.status, "active")));
    case "payment_methods":
      return ok(await db.select().from(finPaymentMethod).where(eq(finPaymentMethod.status, "active")));
    case "petty_cash_accounts":
      return ok(await db.select().from(finPettyCashAccount).where(eq(finPettyCashAccount.status, "active")));
    default:
      return fail("validation_error", `Unknown kind`);
  }
});