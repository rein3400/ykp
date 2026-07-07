import { and, desc, eq } from "drizzle-orm";
import { createHermezDb, hermezAlertLog } from "@ykp/schema";
import { requireAuth } from "@ykp/auth";
import { fail, ok, parseDateParam, toIsoString } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/hermez/alerts?date=&severity=&status=&alert_type=&outlet_id=
 * Returns hermez_alert_log rows matching the filters.
 * Any authenticated user may read the alert list (binding contract: read-only).
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    // Defect Z7 fix: return actual auth status, not always 401.
    const e = err as Error & { status?: number };
    const status = typeof e.status === "number" ? e.status : 401;
    const code = status === 403 ? "forbidden" : "unauth";
    return fail(code, status === 403 ? "Forbidden" : "Unauthorized", status);
  }
  void user;

  const url = new URL(req.url);
  const date = parseDateParam(url.searchParams.get("date"));
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");
  const alertType = url.searchParams.get("alert_type");
  const outletId = url.searchParams.get("outlet_id");

  const db = createHermezDb();

  try {
    const filters = [];
    if (date) filters.push(eq(hermezAlertLog.date, new Date(date)));
    if (severity === "warning" || severity === "critical") {
      filters.push(eq(hermezAlertLog.severity, severity));
    }
    if (status === "open" || status === "ack" || status === "resolved") {
      filters.push(eq(hermezAlertLog.status, status));
    }
    if (alertType) filters.push(eq(hermezAlertLog.alertType, alertType));
    if (outletId) filters.push(eq(hermezAlertLog.outlet, outletId));

    const rows = await db
      .select()
      .from(hermezAlertLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(hermezAlertLog.date), desc(hermezAlertLog.createdAt));

    const items = rows.map((r) => ({
      alertId: r.alertId,
      date: r.date.toISOString().slice(0, 10),
      brand: r.brand,
      outlet: r.outlet,
      alertType: r.alertType,
      severity: r.severity,
      message: r.message,
      sourceApp: r.sourceApp,
      status: r.status,
      actionTaken: r.actionTaken,
      assignedTo: r.assignedTo,
      createdAt: toIsoString(r.createdAt),
      resolvedAt: toIsoString(r.resolvedAt),
    }));

    return ok({ items, total: items.length });
  } catch (e) {
    // Defect S5 fix: no raw error leakage.
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez alerts]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}