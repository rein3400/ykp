/**
 * Daily summary API.
 *  GET  /api/fin/summary?date_from=...&date_to=...&outlet=...
 *  POST /api/fin/summary/rebuild {date, outlet_id?}  -> calls
 *       @ykp/engine generateFinDailySummary for each outlet on date.
 *
 * Rebuild is idempotent: generateFinDailySummary upserts on (date, outlet).
 * When outlet_id is omitted, every active outlet in master DB is rebuilt.
 */
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, can, applyOutletScope } from "@ykp/auth";
import { finDailySummary, masterOutlet } from "@ykp/schema";
import { getMasterDb, getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { generateFinDailySummary } from "@ykp/engine";
import { FinSummaryQuerySchema, FinSummaryRebuildSchema } from "@finance/lib/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinSummaryQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { date_from, date_to, outlet, limit } = parsed.data;
  const db = getFinanceDb();

  const conds = [];
  // finDailySummary.date is a calendar `date` column (WIB day). new Date(str)
  // alone is UTC midnight, which shifts the boundary by the DB-connection TZ
  // and can drop/include a day. Anchor to WIB midnight (+07:00) so the filter
  // matches the calendar day exactly.
  const wibDay = (s: string) => new Date(`${s}T00:00:00+07:00`);
  if (date_from) conds.push(gte(finDailySummary.date, wibDay(date_from)));
  if (date_to) conds.push(lte(finDailySummary.date, wibDay(date_to)));
  if (outlet) conds.push(eq(finDailySummary.outlet, outlet));
  applyOutletScope(user, conds, finDailySummary.outletId);

  const rows = await db
    .select()
    .from(finDailySummary)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(finDailySummary.date))
    .limit(limit);

  return ok(rows);
});

export const POST = handler(async (req: Request) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  if (!can(user.role, "report", "read")) {
    return fail("forbidden", "Role cannot rebuild summary");
  }
  const body = await req.json();
  const parsed = FinSummaryRebuildSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid rebuild body", parsed.error.flatten());

  const { date, outlet_id } = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  let outlets: { outletId: string }[];
  if (outlet_id) {
    outlets = [{ outletId: outlet_id }];
  } else {
    outlets = await masterDb.select({ outletId: masterOutlet.outletId }).from(masterOutlet);
  }

  const rebuilt: { outlet_id: string; ok: boolean; error?: string }[] = [];
  for (const o of outlets) {
    try {
      const row = await generateFinDailySummary({
        financeDb,
        masterDb,
        date,
        outlet_id: o.outletId,
      });
      rebuilt.push({ outlet_id: o.outletId, ok: true });
      void row;
    } catch (e) {
      rebuilt.push({ outlet_id: o.outletId, ok: false, error: (e as Error).message });
    }
  }

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_daily_summary:rebuild",
    entity: "fin_daily_summary",
    entityId: `${date}|${outlet_id ?? "all"}`,
    after: { rebuilt_count: rebuilt.filter((r) => r.ok).length, failed: rebuilt.filter((r) => !r.ok).length },
  });

  // Touch sql import so tree-shake keeps it for the query path above.
  void sql;

  return ok({ date, rebuilt });
});