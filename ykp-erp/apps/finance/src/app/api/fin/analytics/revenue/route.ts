/**
 * GET /api/fin/analytics/revenue?period=...&brand_id=...&outlet_id=...
 *
 * Aggregates fin_pos_daily into:
 *   { total, by_day: [{date, revenue}], by_payment: [{method, revenue}] }
 *
 * period controls the default date_from window when not supplied:
 *   day   -> today
 *   week  -> last 7 days
 *   month -> current month
 *   quarter -> last 90 days
 *   year  -> last 365 days
 */
import { and, eq, gte, lte, sql, sum, desc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosDaily } from "@ykp/schema";
import { getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { todayWib } from "@ykp/engine";
import { FinAnalyticsPeriodSchema } from "@/lib/schemas.js";

function windowFor(period: string): { from: string; to: string } {
  const today = new Date(todayWib());
  const to = today;
  let from = new Date(today);
  switch (period) {
    case "day":
      break;
    case "week":
      from.setDate(today.getDate() - 6);
      break;
    case "month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "quarter":
      from.setDate(today.getDate() - 89);
      break;
    case "year":
      from.setFullYear(today.getFullYear() - 1);
      break;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`, to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}` };
}

export const GET = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  void user;
  const search = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = FinAnalyticsPeriodSchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { period, brand_id, outlet_id, date_from, date_to } = parsed.data;
  const win = windowFor(period);
  const from = date_from ?? win.from;
  const to = date_to ?? win.to;

  const db = getFinanceDb();
  const conds = [gte(finPosDaily.date, from), lte(finPosDaily.date, to)];
  if (brand_id) conds.push(eq(finPosDaily.brandId, brand_id));
  if (outlet_id) conds.push(eq(finPosDaily.outletId, outlet_id));

const byDay = await db
    .select({ date: finPosDaily.date, revenue: sum(finPosDaily.netSales) })
    .from(finPosDaily)
    .where(and(...conds))
    .groupBy(finPosDaily.date)
    .orderBy(finPosDaily.date);

  // Fill zero days in the requested range so the chart is continuous.
  const dayMap = new Map<string, number>();
  for (const r of byDay) {
    const key = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
    dayMap.set(key, Number(r.revenue ?? 0));
  }
  const filledByDay: { date: string; revenue: number }[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    filledByDay.push({ date: key, revenue: dayMap.get(key) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Payment method breakdown from jsonb aggregate.
  const rows = await db
    .select({ breakdown: finPosDaily.paymentMethodBreakdown })
    .from(finPosDaily)
    .where(and(...conds));
  const byPaymentMap = new Map<string, number>();
  for (const r of rows) {
    const b = r.breakdown as Record<string, number> | null;
    if (!b) continue;
    for (const [k, v] of Object.entries(b)) byPaymentMap.set(k, (byPaymentMap.get(k) ?? 0) + Number(v));
  }

  const total = filledByDay.reduce((acc, r) => acc + r.revenue, 0);
  void sql; void desc;

  return ok({
    period,
    from,
    to,
    total,
    by_day: filledByDay,
    by_payment: Array.from(byPaymentMap.entries()).map(([method, revenue]) => ({ method, revenue })),
  });
});