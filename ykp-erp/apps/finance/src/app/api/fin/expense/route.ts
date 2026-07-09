/**
 * Expense API.
 *  GET  /api/fin/expense?date_from=...&category_id=...&outlet_id=...
 *  POST /api/fin/expense {date,outlet_id,category_id,amount,payment_method_id,...}
 *
 * Every new expense starts as PENDING. Approval is a separate dedicated
 * FSM gate at /api/fin/expense/:id/approve; auto-approval is forbidden so
 * that every spend is reviewable and the audit log stays complete.
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can, applyOutletScope } from "@ykp/auth";
import { finExpense } from "@ykp/schema";
import { getMasterDb, getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { assertOutlet, assertExpenseCategory, assertPaymentMethod } from "@/lib/server/refs.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { financeDayId } from "@ykp/engine";
import { FinExpenseQuerySchema, FinExpenseCreateSchema } from "@/lib/schemas.js";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  const search = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = FinExpenseQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { date_from, date_to, category_id, outlet_id, approval_status, limit } = parsed.data;
  const db = getFinanceDb();

  const conds = [];
  if (date_from) conds.push(gte(finExpense.date, date_from));
  if (date_to) conds.push(lte(finExpense.date, date_to));
  if (category_id) conds.push(eq(finExpense.categoryId, category_id));
  if (outlet_id) conds.push(eq(finExpense.outletId, outlet_id));
  if (approval_status) conds.push(eq(finExpense.approvalStatus, approval_status));
  applyOutletScope(user, conds, finExpense.outletId);

  const rows = await db
    .select()
    .from(finExpense)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(finExpense.date))
    .limit(limit);

  return ok(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER, Role.STAFF_INPUT,
  ]);
  if (!can(user.role, "expense", "create")) {
    return fail("forbidden", "Role cannot create expense rows");
  }

  const body = await req.json();
  const parsed = FinExpenseCreateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid expense payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  const outlet = await assertOutlet(masterDb, data.outlet_id);
  await assertExpenseCategory(masterDb, data.category_id);
  await assertPaymentMethod(masterDb, data.payment_method_id);

  // Every expense starts at PENDING. Approval is performed via the dedicated
  // /api/fin/expense/:id/approve route which runs the finance FSM.
  const approvalStatus: "PENDING" = "PENDING";

  // Defect S1 fix: allocate expenseId inside a transaction with FOR UPDATE.
  const expenseId = await financeDb.transaction(async (tx) => {
    const existing = await tx
      .select({ count: finExpense.expenseId })
      .from(finExpense)
      .where(and(eq(finExpense.date, data.date), eq(finExpense.outletId, data.outlet_id)))
      .for("update");
    const seq = existing.length + 1;
    return financeDayId(data.date, seq, data.outlet_id);
  });

  const [inserted] = await financeDb
    .insert(finExpense)
    .values({
      expenseId,
      date: new Date(data.date),
      brandId: outlet.brandId,
      brandName: "",
      outletId: data.outlet_id,
      outletName: outlet.outletName,
      categoryId: data.category_id,
      description: data.description ?? null,
      amount: data.amount,
      paymentMethodId: data.payment_method_id,
      attachmentUrl: data.attachment_url ?? null,
      approvalStatus,
      approvedBy: null,
      notes: data.notes ?? null,
      source: "manual",
      recordedBy: user.id,
    })
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "expense:created",
    entity: "fin_expense",
    entityId: inserted.expenseId,
    after: inserted,
  });

  return ok(inserted, 201);
});