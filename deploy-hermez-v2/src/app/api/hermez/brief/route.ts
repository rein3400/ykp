import { eq, desc } from "drizzle-orm";
import { createHermezDb, hermezDailyBrief } from "../../../../../_packages/schema/src";
import { requireOwnerOrSuperAdmin, fail, ok, parseDateParam, toIsoString, mapAuthError } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/hermez/brief?date=YYYY-MM-DD
 * Returns the latest hermez_daily_brief row, or the one for `date` if given.
 * Requires OWNER or SUPER_ADMIN.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireOwnerOrSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }
  void user;

  const url = new URL(req.url);
  const date = parseDateParam(url.searchParams.get("date"));

  const db = createHermezDb();

  try {
    if (date) {
      const rows = await db
        .select()
        .from(hermezDailyBrief)
        .where(eq(hermezDailyBrief.date, new Date(date)))
        .limit(1);
      const row = rows[0] ?? null;
      if (!row) return ok({ brief: null });
      return ok({
        brief: {
          briefId: row.briefId,
          date: date,
          alertLevel: row.alertLevel,
          briefText: row.briefText,
          sentToOwner: row.sentToOwner,
          sentAt: toIsoString(row.sentAt),
          generatedAt: toIsoString(row.generatedAt),
        },
      });
    }

    const rows = await db
      .select()
      .from(hermezDailyBrief)
      .orderBy(desc(hermezDailyBrief.date))
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) return ok({ brief: null });
    const dateStr = row.date.toISOString().slice(0, 10);
    return ok({
      brief: {
        briefId: row.briefId,
        date: dateStr,
        alertLevel: row.alertLevel,
        briefText: row.briefText,
        sentToOwner: row.sentToOwner,
        sentAt: toIsoString(row.sentAt),
        generatedAt: toIsoString(row.generatedAt),
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez brief]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}