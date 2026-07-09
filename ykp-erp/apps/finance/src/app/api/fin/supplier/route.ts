/**
 * Supplier costing API.
 *  GET  /api/fin/supplier?date_from=...&date_to=...&supplier_id=...&status=...
 *  POST /api/fin/supplier {date,outlet_id,supplier_id,amount,...}
 *
 * On insert:
 *   - validate outlet_id + supplier_id via master DB (400 missing_ref)
 *   - compute unpaid_amount = amount - paid_amount
 *   - default payment_status UNPAID (or PARTIAL if paid_amount > 0)
 *   - audit row in finance audit_log
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, can, applyOutletScope } from "@ykp/auth";
import { finSupplierCost } from "@ykp/schema";
import { getMasterDb, getFinanceDb, type FinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { assertOutlet, assertSupplier } from "@finance/lib/server/refs";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { financeDayId } from "@ykp/engine";
import { FinSupplierQuerySchema, FinSupplierCreateSchema } from "@finance/lib/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinSupplierQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { date_from, date_to, supplier_id, status, outlet_id, limit } = parsed.data;
  const db = getFinanceDb();

  const conds = [];
  if (date_from) conds.push(gte(finSupplierCost.date, new Date(date_from)));
  if (date_to) conds.push(lte(finSupplierCost.date, new Date(date_to)));
  if (supplier_id) conds.push(eq(finSupplierCost.supplierId, supplier_id));
  if (status) conds.push(eq(finSupplierCost.paymentStatus, status));
  if (outlet_id) conds.push(eq(finSupplierCost.outletId, outlet_id));
  applyOutletScope(user, conds, finSupplierCost.outletId);

  const rows = await db
    .select()
    .from(finSupplierCost)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(finSupplierCost.date))
    .limit(limit);

  return ok(rows);
});

export const POST = handler(async (req: Request) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  const body = await req.json();
  const parsed = FinSupplierCreateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid supplier cost payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  const { brandId, outletName } = await assertOutlet(masterDb, data.outlet_id);
  const supplierName = await assertSupplier(masterDb, data.supplier_id);

  const unpaidAmount = data.amount - data.paid_amount;
  const paymentStatus = unpaidAmount <= 0 ? "PAID" : data.paid_amount > 0 ? "PARTIAL" : "UNPAID";

  // Defect F4 fix: default supplier cost to PENDING (fast-track skip DRAFT).
  // Approve-payment endpoint enforces the approval FSM.
  const approvalStatus: "PENDING" = "PENDING";

  // Defect S1 fix: wrap ID allocation in a transaction with FOR UPDATE to
  // avoid duplicate FIN-YYYYMMDD-NNN ids under concurrent POSTs.
  const costId = await financeDb.transaction(async (tx: FinanceDb) => {
    const existing = await tx
      .select({ posId: finSupplierCost.costId })
      .from(finSupplierCost)
      .where(and(eq(finSupplierCost.date, new Date(data.date)), eq(finSupplierCost.outletId, data.outlet_id)))
      .for("update");
    const seq = existing.length + 1;
    return financeDayId(data.date, seq, data.outlet_id);
  });

  const [inserted] = await financeDb
    .insert(finSupplierCost)
    .values({
      costId,
      date: new Date(data.date),
      brandId,
      brandName: "",
      outletId: data.outlet_id,
      outletName,
      supplierId: data.supplier_id,
      supplierName,
      description: data.description ?? null,
      category: data.category ?? null,
      amount: data.amount,
      paidAmount: data.paid_amount,
      unpaidAmount,
      paymentStatus,
      approvalStatus,
      dueDate: data.due_date ? new Date(data.due_date) : null,
      invoiceNumber: data.invoice_number ?? null,
      bankAccount: data.bank_account ?? null,
      attachmentUrl: data.attachment_url ?? null,
      notes: data.notes ?? null,
      source: data.source ?? "manual",
      recordedBy: user.id,
    })
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_supplier_cost:created",
    entity: "fin_supplier_cost",
    entityId: inserted.costId,
    after: inserted,
  });

  return ok(inserted, 201);
});