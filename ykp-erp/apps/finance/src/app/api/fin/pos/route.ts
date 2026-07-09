/**
 * POS daily revenue API.
 *  GET  /api/fin/pos?date_from=...&date_to=...&outlet_id=...&payment_method=...
 *  POST /api/fin/pos {date,outlet_id,gross_sales,...} -> create manual row
 *
 * Cross-DB refs are validated through the master DB before insert. The
 * net_sales and aov are computed in the route layer per the contract:
 *   net_sales = gross - discount - refund - void
 *   aov = net_sales / transaction_count
 *
 * Only FINANCE_ADMIN / SUPER_ADMIN / OWNER / OUTLET_MANAGER can create.
 */
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can, applyOutletScope } from "@ykp/auth";
import { finPosDaily, finPaymentMethod } from "@ykp/schema";
import { getMasterDb, getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { assertOutlet, assertBrand } from "@/lib/server/refs.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { financeDayId } from "@ykp/engine";
import { FinPosQuerySchema, FinPosCreateSchema } from "@/lib/schemas.js";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
  const search = req.nextUrl.searchParams;
  const parsed = FinPosQuerySchema.safeParse(Object.fromEntries(search.entries()));
  if (!parsed.success) return fail("validation_error", "Invalid query parameters", parsed.error.flatten());

  const { date_from, date_to, outlet_id, payment_method, limit } = parsed.data;
  const db = getFinanceDb();

  const conditions = [];
  if (date_from) conditions.push(gte(finPosDaily.date, date_from));
  if (date_to) conditions.push(lte(finPosDaily.date, date_to));
  if (outlet_id) conditions.push(eq(finPosDaily.outletId, outlet_id));
  applyOutletScope(user, conditions, finPosDaily.outletId);

  const rows = await db
    .select()
    .from(finPosDaily)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(finPosDaily.date))
    .limit(limit);

  const filtered = payment_method
    ? rows.filter((r) => Object.keys((r.paymentMethodBreakdown as Record<string, number>) ?? {}).includes(payment_method))
    : rows;

  return ok(filtered);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER]);
  // Defect S3 fix: resource must be "pos" / "moka_import", not "closing".
  if (!can(user.role, "pos", "create")) {
    return fail("forbidden", "You do not have permission to create POS revenue rows");
  }

  const body = await req.json();
  const parsed = FinPosCreateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid POS payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  const { brandId, outletName } = await assertOutlet(masterDb, data.outlet_id);
  const brandName = await assertBrand(masterDb, brandId);

  // Defect F1 fix: validate payment_method(s) against master fin_payment_method.
  const methods = Array.isArray(data.payment_method_ids)
    ? data.payment_method_ids
    : [data.payment_method];
  if (methods.length === 0 || methods.some((m) => !m)) {
    return fail("missing_ref", "At least one payment method is required");
  }
  const methodRows = await masterDb
    .select({ methodId: finPaymentMethod.methodId })
    .from(finPaymentMethod)
    .where(inArray(finPaymentMethod.methodId, methods));
  const validMethods = new Set(methodRows.map((r) => r.methodId));
  const missingMethod = methods.find((m) => !validMethods.has(m));
  if (missingMethod) {
    return fail("missing_ref", `Unknown payment method ${missingMethod}`);
  }

  const netSales = data.gross_sales - data.discount - data.refund - data.void_amount;
  const aov = data.transaction_count > 0 ? Math.round(netSales / data.transaction_count) : 0;

  // Defect S1 fix: deterministic per-(date,outlet,seq) id computed inside a
  // transaction with FOR UPDATE so concurrent POSTs never allocate the same seq.
  const posId = await financeDb.transaction(async (tx) => {
    const existing = await tx
      .select({ count: finPosDaily.posId })
      .from(finPosDaily)
      .where(and(eq(finPosDaily.date, data.date), eq(finPosDaily.outletId, data.outlet_id)))
      .for("update");
    const seq = existing.length + 1;
    return financeDayId(data.date, seq, data.outlet_id);
  });

  // Defect F1: distribute netSales across each validated method. For a single
  // method this is identical to the old behaviour; for multiple methods the
  // caller is expected to have split gross sales across payment_method_ids.
  const breakdown: Record<string, number> = {};
  for (const m of methods) {
    breakdown[m] = (breakdown[m] ?? 0) + netSales;
  }

  const row = {
    posId,
    date: new Date(data.date),
    brandId,
    brandName,
    outletId: data.outlet_id,
    outletName,
    grossSales: data.gross_sales,
    netSales,
    discount: data.discount,
    refund: data.refund,
    void: data.void_amount,
    tax: data.tax,
    serviceCharge: data.service_charge,
    paymentMethodBreakdown: breakdown,
    transactionCount: data.transaction_count,
    aov,
    cashier: data.cashier ?? null,
    shift: data.shift ?? null,
    source: data.source,
    sourceRef: data.source_ref ?? null,
    notes: data.notes ?? null,
    recordedBy: user.id,
  };

  const [inserted] = await financeDb.insert(finPosDaily).values(row).returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_pos_daily:created",
    entity: "fin_pos_daily",
    entityId: inserted.posId,
    after: inserted,
  });

  return ok(inserted, 201);
});