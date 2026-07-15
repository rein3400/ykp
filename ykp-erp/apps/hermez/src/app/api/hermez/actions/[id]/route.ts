import { eq } from "drizzle-orm";
import {
  createHermezDb,
  hermezActionTracker,
  hermezAuditLog,
} from "@ykp/schema";
import { Role, requireRole } from "@ykp/auth";
import { fail, ok, toDateString, toIsoString } from "../../_helpers";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "DONE",
  "CANCELLED",
  "OVERDUE",
]);

interface PatchPayload {
  status?: string;
  actionTaken?: string;
}

/**
 * PATCH /api/hermez/actions/[id]
 * Updates an action's status + actionTaken. Owner/Super_Admin only.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole([Role.OWNER, Role.SUPER_ADMIN]);
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = typeof e.status === "number" ? e.status : 401;
    const code = status === 403 ? "forbidden" : "unauth";
    return fail(code, status === 403 ? "Forbidden: insufficient role" : "Unauthorized", status);
  }

  const { id } = await ctx.params;

  let body: PatchPayload;
  try {
    body = (await req.json()) as PatchPayload;
  } catch {
    return fail("validation", "Invalid JSON body", 400);
  }

  if (body.status && !VALID_STATUS.has(body.status)) {
    return fail("validation", "status must be a valid action status", 400);
  }

  const db = createHermezDb();

  try {
    const existing = await db
      .select()
      .from(hermezActionTracker)
      .where(eq(hermezActionTracker.actionId, id))
      .limit(1);
    const before = existing[0] ?? null;
    if (!before) return fail("not-found", "Action not found", 404);

    const nextStatus = body.status ?? before.status;
    const actionTaken = typeof body.actionTaken === "string" ? body.actionTaken : before.actionTaken;
    const completedAt =
      nextStatus === "DONE" || nextStatus === "CANCELLED"
        ? new Date()
        : before.completedAt;

    const updated = await db
      .update(hermezActionTracker)
      .set({
        status: nextStatus as typeof before.status,
        actionTaken,
        completedAt,
      })
      .where(eq(hermezActionTracker.actionId, id))
      .returning();

    const row = updated[0];
    if (!row) return fail("not-found", "Action not found after update", 404);

    await db.insert(hermezAuditLog).values({
      actor: user.email,
      action: "action.status_change",
      entity: "hermez_action_tracker",
      entityId: id,
      before: { status: before.status, actionTaken: before.actionTaken },
      after: { status: nextStatus, actionTaken, completedAt: toIsoString(completedAt) },
      reason: `Manual status change by ${user.role}`,
    });

    return ok({
      action: {
        actionId: row.actionId,
        sourceAlertId: row.sourceAlertId,
        title: row.title,
        brand: row.brand,
        outlet: row.outlet,
        assignedTo: row.assignedTo,
        priority: row.priority,
        dueDate: toDateString(row.dueDate),
        status: row.status,
        actionTaken: row.actionTaken,
        createdAt: toIsoString(row.createdAt),
        completedAt: toIsoString(row.completedAt),
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez actions PATCH]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}