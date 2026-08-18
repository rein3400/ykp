import {
  createHermezDb,
  createHrDb,
  createFinanceDb,
  createMasterDb,
} from "../../../../../_packages/schema/src";
import { generateBriefForDate, todayWib } from "../../../../../_packages/engine/src";
import { requireSuperAdmin, fail, ok, mapAuthError } from "../_helpers";

export const dynamic = "force-dynamic";

interface RunPayload {
  date?: string;
}

/**
 * POST /api/hermez/run { date? }
 * Triggers generateBriefForDate for the given date (defaults to today WIB).
 * Requires SUPER_ADMIN. CRON_SECRET-protected when called via cron: the
 * caller may set `x-cron-secret` header to bypass role check.
 */
export async function POST(req: Request) {
  // CRON_SECRET bypass: if header matches env, skip role check (cron worker).
  const cronSecret = process.env.HERMEZ_CRON_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && headerSecret === cronSecret;

  if (!isCron) {
    try {
      await requireSuperAdmin();
    } catch (err) {
      return mapAuthError(err);
    }
  }

  let body: RunPayload = {};
  try {
    body = (await req.json().catch(() => ({}))) as RunPayload;
  } catch {
    // empty body is fine — default date below
  }

  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();

  const hermezDb = createHermezDb();
  const hrDb = createHrDb();
  const financeDb = createFinanceDb();
  const masterDb = createMasterDb();

  try {
    const result = await generateBriefForDate({
      hermezDb,
      hrDb,
      financeDb,
      masterDb,
      date,
    });

    return ok({
      brief_id: result.brief.briefId,
      date,
      alert_count: result.alerts.length,
      level: result.brief.alertLevel,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez run]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}