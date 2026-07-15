import { readTab, TABS, readFinanceTab } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const [investors, capital, dividend] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.dividend)
  ]);
  let finSummary: Record<string, string>[] = [];
  try { finSummary = await readFinanceTab<Record<string, string>>('fin_daily_summary'); } catch { /* not configured */ }
  const totalCapital = capital.reduce((sum, c) => sum + (c.type === 'in' ? Number(c.amount || 0) : -Number(c.amount || 0)), 0);
  const totalDividend = dividend.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalRevenue = finSummary.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalProfit = finSummary.reduce((s, r) => s + Number(r.net_profit_estimate || 0), 0);
  return ok({
    active_investors: investors.filter((i) => i.status === 'active').length,
    total_capital: totalCapital,
    total_revenue: totalRevenue,
    total_profit: totalProfit,
    total_dividend_paid: totalDividend,
    finance_summary_rows: finSummary.length
  });
});