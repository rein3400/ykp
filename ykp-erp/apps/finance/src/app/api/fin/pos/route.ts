/**
 * POS daily revenue API.
 *  GET  /api/fin/pos?date_from=...&date_to=...&outlet_id=...&payment_method=...
 *  POST /api/fin/pos — GONE; use POST /api/fin/pos/receipts instead.
 *
 * Daily rows are now aggregated from individual receipts via the
 * fin_pos_daily_view view, kept at the same response shape as the old
 * fin_pos_daily table for backwards compatibility.
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, applyOutletScope } from "@ykp/auth";
import { finPosDailyView } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { FinPosQuerySchema } from "@finance/lib/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN,
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.BRAND_MANAGER,
    Role.OUTLET_MANAGER,
    Role.VIEWER,
  ]);

  const search = new URL(req.url).searchParams;
  const parsed = FinPosQuerySchema.safeParse(Object.fromEntries(search.entries()));
  if (!parsed.success)
    return fail("validation_error", "Invalid query parameters", parsed.error.flatten());

  const { date_from, date_to, outlet_id, payment_method, limit } = parsed.data;
  const db = getFinanceDb();

  const conditions = [];
  if (date_from) conditions.push(gte(finPosDailyView.date, new Date(date_from)));
  if (date_to) conditions.push(lte(finPosDailyView.date, new Date(date_to)));
  if (outlet_id) conditions.push(eq(finPosDailyView.outletId, outlet_id));
  applyOutletScope(user, conditions, finPosDailyView.outletId);

  const rows = await db
    .select()
    .from(finPosDailyView)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(finPosDailyView.date))
    .limit(limit);

  const filtered = payment_method
    ? rows.filter((r) =>
        Object.keys((r.paymentMethodBreakdown as Record<string, number>) ?? {}).includes(
          payment_method,
        ),
      )
    : rows;

  return ok(filtered);
});

export const POST = handler(async () => {
  return fail(
    "gone",
    "Use POST /api/fin/pos/receipts to create individual receipts",
  );
});
