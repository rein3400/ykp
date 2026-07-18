/**
 * Individual POS receipts API.
 *  GET  /api/fin/pos/receipts?date=...&outlet_id=...&date_from=...&date_to=...
 *  POST /api/fin/pos/receipts {date,brand_id,brand_name,outlet_id,outlet_name,receipt_number,...}
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, applyOutletScope } from "@ykp/auth";
import { finPosReceipts } from "@ykp/schema";
import { getMasterDb, getFinanceDb, type FinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { assertOutlet } from "@finance/lib/server/refs";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { receiptId } from "@ykp/engine";
import {
  FinPosReceiptCreateSchema,
  FinPosReceiptQuerySchema,
} from "@finance/lib/schemas";

/** Next receipt sequence for (date, outlet) — count existing + 1. */
async function getNextReceiptSeq(
  db: FinanceDb,
  date: string,
  outletId: string,
): Promise<number> {
  const rows = await db
    .select({ receiptId: finPosReceipts.receiptId })
    .from(finPosReceipts)
    .where(
      and(
        eq(finPosReceipts.date, new Date(date)),
        eq(finPosReceipts.outletId, outletId),
      ),
    );
  return rows.length + 1;
}

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN,
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.BRAND_MANAGER,
    Role.OUTLET_MANAGER,
    Role.VIEWER,
  ]);

  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinPosReceiptQuerySchema.safeParse(search);
  if (!parsed.success)
    return fail("validation_error", "Invalid query parameters", parsed.error.flatten());

  const { date, date_from, date_to, outlet_id, brand_id, limit } = parsed.data;
  const db = getFinanceDb();
  const conds = [];

  if (date) conds.push(eq(finPosReceipts.date, new Date(date)));
  if (date_from) conds.push(gte(finPosReceipts.date, new Date(date_from)));
  if (date_to) conds.push(lte(finPosReceipts.date, new Date(date_to)));
  if (outlet_id) conds.push(eq(finPosReceipts.outletId, outlet_id));
  if (brand_id) conds.push(eq(finPosReceipts.brandId, brand_id));
  applyOutletScope(user, conds, finPosReceipts.outletId);

  const rows = await db
    .select()
    .from(finPosReceipts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(finPosReceipts.date), desc(finPosReceipts.createdAt))
    .limit(limit);

  return ok(rows);
});

export const POST = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN,
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.OUTLET_MANAGER,
  ]);

  const body = await req.json();
  const parsed = FinPosReceiptCreateSchema.safeParse(body);
  if (!parsed.success)
    return fail("validation_error", "Invalid receipt payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  await assertOutlet(masterDb, data.outlet_id);

  const netSales = Math.max(
    0,
    data.gross_sales -
      (data.discount ?? 0) -
      (data.refund ?? 0) -
      (data.void_amount ?? 0),
  );
  const paymentBreakdown =
    data.payment_breakdown ?? { [data.payment_method_id]: data.payment_amount };

  const existing = await financeDb
    .select({ receiptId: finPosReceipts.receiptId })
    .from(finPosReceipts)
    .where(
      and(
        eq(finPosReceipts.date, new Date(data.date)),
        eq(finPosReceipts.outletId, data.outlet_id),
        eq(finPosReceipts.receiptNumber, data.receipt_number),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return fail(
      "conflict",
      "Receipt already exists for this date, outlet, and receipt number",
      { receipt_id: existing[0].receiptId },
    );
  }

  const seq = await getNextReceiptSeq(financeDb, data.date, data.outlet_id);
  const id = receiptId(data.date, data.outlet_id, seq);

  const [inserted] = await financeDb
    .insert(finPosReceipts)
    .values({
      receiptId: id,
      date: new Date(data.date),
      brandId: data.brand_id,
      brandName: data.brand_name,
      outletId: data.outlet_id,
      outletName: data.outlet_name,
      receiptNumber: data.receipt_number,
      transactionTime: data.transaction_time ?? null,
      grossSales: data.gross_sales,
      discount: data.discount ?? 0,
      refund: data.refund ?? 0,
      void: data.void_amount ?? 0,
      tax: data.tax ?? 0,
      serviceCharge: data.service_charge ?? 0,
      netSales,
      paymentMethodId: data.payment_method_id,
      paymentAmount: data.payment_amount,
      paymentBreakdown,
      transactionCount: data.transaction_count ?? 1,
      cashier: data.cashier ?? null,
      shift: data.shift ?? null,
      source: data.source ?? "manual",
      sourceRef: data.source_ref ?? null,
      notes: data.notes ?? null,
      photoUrl: data.photo_url ?? null,
      photoPath: data.photo_path ?? null,
      recordedBy: user.id,
    })
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_pos_receipt:created",
    entity: "fin_pos_receipts",
    entityId: inserted.receiptId,
    after: inserted,
  });

  return ok(inserted, 201);
});
