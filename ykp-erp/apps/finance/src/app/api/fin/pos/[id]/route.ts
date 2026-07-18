/**
 * PATCH /api/fin/pos/:id — DISABLED.
 *
 * fin_pos_daily is now replaced by fin_pos_daily_view (aggregated from
 * fin_pos_receipts). Source-of-truth mutations must go through the receipt
 * endpoints: POST /api/fin/pos/receipts or verify/delete per receipt.
 */
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { handler, fail } from "@finance/lib/server/http";

export const PATCH = handler(async () => {
  await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  return fail(
    "gone",
    "POS daily rows are now aggregated from receipts. Use /api/fin/pos/receipts for updates.",
  );
});
