import { and, desc, eq } from "drizzle-orm";
import {
  createHermezDb,
  hermezActionTracker,
  hermezAlertLog,
  hermezAuditLog,
} from "@ykp/schema";
import { Role, requireRole } from "@ykp/auth";
import { fail, ok, toDateString, toIsoString } from "../_helpers";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "DONE",
  "CANCELLED",
  "OVERDUE",
]);

const VALID_PRIORITY = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function nextActionId(): string {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = `${Math.floor(Math.random() * 899 + 100)}`;
  return `HZAC-${d}-${suffix}`;
}

/**
 * GET /api/hermez/actions?status=
 * Returns action tracker rows. Any authenticated Hermez user may read.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireRole([
      Role.OWNER,
      Role.SUPER_ADMIN,
      Role.BRAND_MANAGER,
      Role.OUTLET_MANAGER,
    ]);
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = typeof e.status === "number" ? e.status : 401;
    const code = status === 403 ? "forbidden" : "unauth";
    return fail(code, status === 403 ? "Forbidden" : "Unauthorized", status);
  }
  void user;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const db = createHermezDb();

  try {
    const filters = [];
    if (status && VALID_STATUS.has(status)) {
      filters.push(eq(hermezActionTracker.status, status as typeof hermezActionTracker.$inferSelect.status));
    }

    const rows = await db
      .select()
      .from(hermezActionTracker)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(hermezActionTracker.createdAt));

    const items = rows.map((r) => ({
      actionId: r.actionId,
      sourceAlertId: r.sourceAlertId,
      title: r.title,
      brand: r.brand,
      outlet: r.outlet,
      assignedTo: r.assignedTo,
      priority: r.priority,
      dueDate: toDateString(r.dueDate),
      status: r.status,
      actionTaken: r.actionTaken,
      createdAt: toIsoString(r.createdAt),
      completedAt: toIsoString(r.completedAt),
    }));

    return ok({ items, total: items.length });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez actions GET]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}

interface CreatePayload {
  sourceAlertId?: string;
  title: string;
  brand?: string;
  outlet?: string;
  assignedTo?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string;
  status?: "OPEN" | "IN_PROGRESS" | "WAITING_APPROVAL" | "DONE" | "CANCELLED" | "OVERDUE";
}

/**
 * POST /api/hermez/actions
 * Creates an action tracker row. Owner/Super_Admin only.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireRole([Role.OWNER, Role.SUPER_ADMIN]);
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = typeof e.status === "number" ? e.status : 401;
    const code = status === 403 ? "forbidden" : "unauth";
    return fail(code, status === 403 ? "Forbidden: insufficient role" : "Unauthorized", status);
  }

  let body: CreatePayload;
  try {
    body = (await req.json()) as CreatePayload;
  } catch {
    return fail("validation", "Invalid JSON body", 400);
  }

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return fail("validation", "title is required", 400);
  }
  if (body.priority !== undefined && !VALID_PRIORITY.has(body.priority)) {
    return fail("validation", "priority must be LOW, MEDIUM, HIGH or CRITICAL", 400);
  }
  if (body.status !== undefined && !VALID_STATUS.has(body.status)) {
    return fail("validation", "status must be a valid action status", 400);
  }
  if (body.dueDate !== undefined && body.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    return fail("validation", "dueDate must be YYYY-MM-DD", 400);
  }

  const db = createHermezDb();

  try {
    // Optional: validate sourceAlertId points to a real alert.
    if (typeof body.sourceAlertId === "string" && body.sourceAlertId.trim().length > 0) {
      const alert = await db
        .select({ alertId: hermezAlertLog.alertId })
        .from(hermezAlertLog)
        .where(eq(hermezAlertLog.alertId, body.sourceAlertId.trim()))
        .limit(1);
      if (alert.length === 0) {
        return fail("validation", "sourceAlertId does not reference an existing alert", 400);
      }
    }

    const actionId = nextActionId();
    const inserted = await db
      .insert(hermezActionTracker)
      .values({
        actionId,
        sourceAlertId: body.sourceAlertId?.trim() ?? null,
        title: body.title.trim(),
        brand: body.brand?.trim() ?? null,
        outlet: body.outlet?.trim() ?? null,
        assignedTo: body.assignedTo?.trim() ?? null,
        priority: body.priority ?? "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status ?? "OPEN",
        actionTaken: null,
        completedAt: null,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      return fail("server", "Insert failed", 500);
    }

    await db.insert(hermezAuditLog).values({
      actor: user.email,
      action: "action.create",
      entity: "hermez_action_tracker",
      entityId: actionId,
      before: null,
      after: { ...row, dueDate: toDateString(row.dueDate), createdAt: toIsoString(row.createdAt), completedAt: toIsoString(row.completedAt) },
      reason: `Action created by ${user.role}`,
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
    }, 201);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez actions POST]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}
