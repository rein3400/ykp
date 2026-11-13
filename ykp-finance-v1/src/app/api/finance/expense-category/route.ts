import { z } from "zod";
import { readTab, findRow, updateRow, TABS } from "@/db/sheets";
import { getSession } from "@/lib/session";
import { can, type Role } from "@/lib/rbac";
import {
  handler,
  ok,
  forbidden,
  unauthorized,
  badRequest,
  notFound,
  fail,
} from "@/lib/http";
import { logAudit } from "@/lib/audit";
const schema = z.object({
  category_id: z.string().min(1),
  category_name: z.string().trim().min(1).max(150),
});
export const PATCH = handler(async (request) => {
  const user = await getSession();
  if (!user) return unauthorized();
  if (!can(user.role as Role, "update", "master")) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("ID dan nama kategori wajib valid");
  const found = await findRow(
    TABS.expenseCategories,
    "category_id",
    parsed.data.category_id,
  );
  if (!found) return notFound("Kategori tidak ditemukan");
  const before = found.row;
  if (before.category_name === parsed.data.category_name) return ok(before);
  const [expenses, categories] = await Promise.all([
    readTab<Record<string, string>>(TABS.expense),
    readTab<Record<string, string>>(TABS.expenseCategories),
  ]);
  if (expenses.some((row) => row.expense_category === before.category_name))
    return fail(
      "conflict",
      "Kategori sudah dipakai transaksi. Buat kategori baru dan koreksi transaksi yang diperlukan; riwayat tidak diubah massal.",
      409,
    );
  if (
    categories.some(
      (row) =>
        row.category_name.toLowerCase() ===
          parsed.data.category_name.toLowerCase() &&
        row.category_id !== parsed.data.category_id,
    )
  )
    return fail("conflict", "Nama kategori sudah ada", 409);
  const after = { ...before, category_name: parsed.data.category_name };
  await updateRow(TABS.expenseCategories, found.rowNumber, after);
  await logAudit({
    module: "finance",
    action: "update",
    recordType: "expense_category",
    recordId: parsed.data.category_id,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(after),
    userId: user.userId,
  });
  return ok(after);
});
