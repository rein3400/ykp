import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';
import { getFinanceTotals } from '@/lib/finance-summary';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const [investors, capital, dividend, fin] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.dividend),
    getFinanceTotals(),
  ]);
  const totalCapital = capital.reduce((sum, c) => {
    const amt = Number(c.amount || 0);
    return sum + ((c.type || '').toLowerCase() === 'in' ? amt : -amt);
  }, 0);
  const totalDividend = dividend
    .filter((d) => (d.status || '').toLowerCase() === 'paid')
    .reduce((s, d) => s + Number(d.amount || 0), 0);
  return ok({
    active_investors: investors.filter((i) => (i.status || '').toLowerCase() === 'active').length,
    total_capital: totalCapital,
    total_revenue: fin.totalRevenue,
    total_profit: fin.totalProfit,
    total_dividend_paid: totalDividend,
    finance_summary_rows: fin.rowCount,
    finance_source: fin.source,
    finance_error: fin.error ?? null,
  });
});