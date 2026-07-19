/**
 * Per-account petty cash position (Revisi #7): opening, top-up, cash out,
 * running balance, physical cash, difference, closing status — current month
 * by default.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler, forbidden } from '@/lib/http';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { todayWib } from '@/lib/format';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'petty_cash')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const month = q.get('month') ?? todayWib().slice(0, 7);
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);

  const [accounts, rows] = await Promise.all([
    readTab<Record<string, string>>(TABS.pettyCashAccounts),
    readTab<Record<string, string>>(TABS.pettyCash)
  ]);

  const result = accounts
    .filter((a) => (!scope.brandId || a.brand_id === scope.brandId) && (!scope.outletId || a.outlet_id === scope.outletId))
    .map((a) => {
      const mine = rows
        .filter((r) => r.account_id === a.account_id)
        .sort((x, y) => (x.date ?? '').localeCompare(y.date ?? '') || (x.created_at ?? '').localeCompare(y.created_at ?? ''));
      const monthRows = mine.filter((r) => (r.date ?? '').startsWith(month));
      const before = mine.filter((r) => (r.date ?? '') < `${month}-01`);
      const opening = before.length > 0
        ? Number(before.at(-1)?.running_balance || 0)
        : Number(a.opening_balance || 0);
      const topUp = monthRows.reduce((sum, r) => sum + Number(r.debit_topup || 0), 0);
      const cashOut = monthRows.reduce((sum, r) => sum + Number(r.credit_out || 0), 0);
      const lastRow = mine.at(-1);
      const running = Number(lastRow?.running_balance ?? opening + topUp - cashOut);
      const physical = lastRow?.physical_cash ? Number(lastRow.physical_cash) : null;
      const diff = lastRow?.cash_difference ? Number(lastRow.cash_difference) : physical !== null ? physical - running : null;
      return {
        account_id: a.account_id,
        account_name: a.account_name,
        outlet_id: a.outlet_id,
        brand_id: a.brand_id,
        daily_limit: a.daily_limit,
        month,
        opening_balance: opening,
        total_topup: topUp,
        total_cash_out: cashOut,
        running_balance: running,
        physical_cash: physical,
        cash_difference: diff,
        closing_status: lastRow?.closing_status || '',
        cash_on_hand_status: lastRow?.cash_on_hand_status || ''
      };
    });
  return ok({ items: result, month });
});
