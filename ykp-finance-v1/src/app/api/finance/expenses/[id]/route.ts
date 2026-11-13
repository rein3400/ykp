/**
 * Expense row: PATCH (edit, audited before/after), DELETE (finance_admin+,
 * audited — brief §10 delete row requires approval trail).
 */
import { NextRequest } from "next/server";
import { findRow, updateRow, TABS } from "@/db/sheets";
import { getSession } from "@/lib/session";
import {
  ok,
  unauthorized,
  badRequest,
  notFound,
  handler,
  forbidden,
} from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { nowTimestampWib } from "@/lib/format";
import { can, type Role } from "@/lib/rbac";
import { expenseQuantity } from "@/lib/expense-quantity";
import { assertExpenseCategory } from "@/lib/repo";

const EDITABLE = [
  "date",
  "expense_category",
  "description",
  "amount",
  "payment_method",
  "receipt_url",
  "notes",
  "qty",
] as const;

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, "update", "expense")) return forbidden("Forbidden");

  const found = await findRow(TABS.expense, "expense_id", params.id);
  if (!found) return notFound(`expense_id not found: ${params.id}`);

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (s.outletId && found.row.outlet_id !== s.outletId) return forbidden();
  if (s.brandId && found.row.brand_id !== s.brandId) return forbidden();
  if (
    found.row.status === "CANCELLED" ||
    found.row.approval_status === "CANCELLED"
  )
    return badRequest("Expense dibatalkan tidak dapat diedit");
  if (body.qty !== undefined) {
    try {
      body.qty = expenseQuantity(body.qty);
    } catch (error) {
      return badRequest(
        error instanceof Error ? error.message : "Qty tidak valid",
      );
    }
  }
  if (body.expense_category !== undefined) {
    if (
      typeof body.expense_category !== "string" ||
      !body.expense_category.trim()
    )
      return badRequest("Kategori wajib diisi");
    try {
      await assertExpenseCategory(body.expense_category);
    } catch {
      return badRequest("Kategori tidak ditemukan/valid");
    }
  }
  const before = { ...found.row };
  const next = { ...found.row };
  for (const k of EDITABLE) {
    if (body[k] !== undefined) next[k] = body[k];
  }
  if (
    next.amount !== undefined &&
    (!Number.isSafeInteger(Number(next.amount)) || Number(next.amount) <= 0)
  )
    return badRequest("amount must be > 0");
  next.updated_at = nowTimestampWib();

  await updateRow(TABS.expense, found.rowNumber, next);
  await logAudit({
    module: "finance",
    action: "update",
    recordType: "fin_expense",
    recordId: params.id,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
    reason: body.reason ?? "",
    userId: s.userId,
  }).catch(() => null);
  return ok(next);
});

export const DELETE = handler(async (_req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, "delete", "expense")) return forbidden("Forbidden");

  const found = await findRow(TABS.expense, "expense_id", params.id);
  if (!found) return notFound(`expense_id not found: ${params.id}`);

  const before = { ...found.row };
  // Soft delete: CANCELLED rows are excluded from every summary figure
  const next = {
    ...found.row,
    status: "CANCELLED",
    approval_status: "CANCELLED",
    updated_at: nowTimestampWib(),
  };
  await updateRow(TABS.expense, found.rowNumber, next);
  await logAudit({
    module: "finance",
    action: "delete",
    recordType: "fin_expense",
    recordId: params.id,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(next),
    userId: s.userId,
  }).catch(() => null);
  return ok(next);
});
