/**
 * GET /api/fin/petty-cash/balance?outlet_id=...&as_of=YYYY-MM-DD
 *
 * Running balance per outlet as of date:
 *   balance = opening_balance + sum(type='in') - sum(type='out' APPROVED)
 *
 * Computed in-app since the contract says running_balance is rolled
 * forward in the application layer (not stored). Reads
 * fin_opening_balance for the latest effective opening, sums cashbook.
 */
import { and, eq, lte, sql } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPettyCash, finOpeningBalance } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { FinPettyCashBalanceQuerySchema } from "@finance/lib/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  void user;
  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinPettyCashBalanceQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { outlet_id, as_of } = parsed.data;
  const db = getFinanceDb();

  // Latest opening balance with effective_date <= as_of.
  const opening = await db
    .select({
      petty_cash_balance: finOpeningBalance.pettyCashBalance,
      effective_date: finOpeningBalance.effectiveDate,
    })
    .from(finOpeningBalance)
    .where(and(eq(finOpeningBalance.outletId, outlet_id), lte(finOpeningBalance.effectiveDate, new Date(as_of))))
    .orderBy(sql`${finOpeningBalance.effectiveDate} desc`)
    .limit(1);
  const openingBalance = opening[0]?.petty_cash_balance ?? 0;

  // Defect F7 fix: only count APPROVED rows in BOTH directions.
  const rows = await db
    .select({ type: finPettyCash.type, amount: finPettyCash.amount, status: finPettyCash.approvalStatus })
    .from(finPettyCash)
    .where(and(eq(finPettyCash.outletId, outlet_id), lte(finPettyCash.date, new Date(as_of))));

  let cashIn = 0;
  let cashOut = 0;
  for (const r of rows) {
    if (r.status !== "APPROVED") continue;
    if (r.type === "in") cashIn += r.amount;
    else if (r.type === "out") cashOut += r.amount;
  }

  return ok({
    outlet_id,
    as_of,
    opening_balance: openingBalance,
    cash_in: cashIn,
    cash_out: cashOut,
    running_balance: openingBalance + cashIn - cashOut,
  });
});