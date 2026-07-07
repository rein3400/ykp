import { eq } from "drizzle-orm";
import { createHermezDb, createMasterDb, hermezAlertLog, hermezAuditLog, masterOutlet } from "@ykp/schema";
import { Role, can, requireRole } from "@ykp/auth";
import { fail, ok, toIsoString } from "../../../_helpers";

export const dynamic = "force-dynamic";

interface StatusPayload {
  status?: "ack" | "resolved";
  action_taken?: string;
}

/**
 * POST /api/hermez/alerts/[id]/status
 * Manually update alert status + action_taken + resolved_at.
 * Requires OWNER or BRAND_MANAGER (own outlet). Logs audit. NEVER auto by Hermez.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole([Role.OWNER, Role.SUPER_ADMIN, Role.BRAND_MANAGER, Role.OUTLET_MANAGER]);
  } catch (err) {
    // Defect Z7 fix: return the actual auth status, not always 401.
    const e = err as Error & { status?: number };
    const status = typeof e.status === "number" ? e.status : 401;
    const code = status === 403 ? "forbidden" : "unauth";
    return fail(code, status === 403 ? "Forbidden: insufficient role" : "Unauthorized", status);
  }

  const { id } = await ctx.params;

  let body: StatusPayload;
  try {
    body = (await req.json()) as StatusPayload;
  } catch {
    return fail("validation", "Invalid JSON body", 400);
  }

  if (body.status !== "ack" && body.status !== "resolved") {
    return fail("validation", "status must be 'ack' or 'resolved'", 400);
  }
  if (typeof body.action_taken !== "string" || body.action_taken.trim().length === 0) {
    return fail("validation", "action_taken is required", 400);
  }

  const db = createHermezDb();

  try {
    const existing = await db
      .select()
      .from(hermezAlertLog)
      .where(eq(hermezAlertLog.alertId, id))
      .limit(1);
    const before = existing[0] ?? null;
    if (!before) return fail("not-found", "Alert not found", 404);

    // Defect Z3 fix: isInScope for "alert" must check brand/outlet scope
    // against the alert's outlet. For BRAND_MANAGER, fetch outlet.brand_id
    // from master DB and check if brand_id ∈ user.brandIds. For
    // OUTLET_MANAGER, check if outlet.id ∈ user.outletIds.
    if (!can(user.role, "alert", "update")) {
      return fail("forbidden", "Role cannot update alerts", 403);
    }
    if (user.role === Role.BRAND_MANAGER || user.role === Role.OUTLET_MANAGER) {
      const outletId = before.outlet;
      if (!outletId) {
        return fail("forbidden", "Out of scope for this alert (no outlet)", 403);
      }
      if (user.role === Role.OUTLET_MANAGER) {
        if (!user.outletIds?.includes(outletId)) {
          return fail("forbidden", "Out of scope for this alert (outlet)", 403);
        }
      } else if (user.role === Role.BRAND_MANAGER) {
        const masterDb = createMasterDb();
        const outletRow = await masterDb
          .select({ brandId: masterOutlet.brandId })
          .from(masterOutlet)
          .where(eq(masterOutlet.outletId, outletId))
          .limit(1);
        const outletBrandId = outletRow[0]?.brandId;
        if (!outletBrandId || !user.brandIds?.includes(outletBrandId)) {
          return fail("forbidden", "Out of scope for this alert (brand)", 403);
        }
      }
    }

    const nextStatus = body.status;
    const resolvedAt = nextStatus === "resolved" ? new Date() : before.resolvedAt;
    const actionTaken = body.action_taken;

    const updated = await db
      .update(hermezAlertLog)
      .set({
        status: nextStatus,
        actionTaken,
        resolvedAt,
      })
      .where(eq(hermezAlertLog.alertId, id))
      .returning();

    const row = updated[0];
    if (!row) return fail("not-found", "Alert not found after update", 404);

    await db.insert(hermezAuditLog).values({
      actor: user.email,
      action: "alert.status_change",
      entity: "hermez_alert_log",
      entityId: id,
      before: { status: before.status, actionTaken: before.actionTaken },
      after: { status: nextStatus, actionTaken, resolvedAt: toIsoString(resolvedAt) },
      reason: `Manual status change by ${user.role}`,
    });

    return ok({
      alert: {
        alertId: row.alertId,
        status: row.status,
        actionTaken: row.actionTaken,
        resolvedAt: toIsoString(row.resolvedAt),
      },
    });
  } catch (e) {
    // Defect Z7 / S5 fix: no raw error leakage on 500. Log server-side.
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez alert status]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}