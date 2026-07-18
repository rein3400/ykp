/**
 * Investor daily summary + alert writers.
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { getFinanceTotals } from '@/lib/finance-summary';

export async function regenerateInvestorSummary(date?: string): Promise<Record<string, string>> {
  const d = date ?? todayWib();
  const [investors, capital, dividend, shareholding, fin] = await Promise.all([
    readTab(TABS.investors),
    readTab(TABS.capital),
    readTab(TABS.dividend),
    readTab(TABS.shareholding),
    getFinanceTotals(),
  ]);

  const active = investors.filter((i) => (i.status || '').toLowerCase() === 'active').length;
  const totalCapital = capital
    .filter((c) => (c.type || '').toLowerCase() === 'in')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalDividend = dividend
    .filter((x) => {
      const st = (x.status || '').toLowerCase();
      return st === 'paid' || st === 'declared';
    })
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalRevenue = fin.totalRevenue;
  const totalProfit = fin.totalProfit;

  // growth vs previous summary if any
  const prev = await readTab(TABS.summary);
  const last = prev.filter((r) => r.date !== d).slice(-1)[0];
  const prevCapital = Number(last?.total_capital || 0);
  const growth = prevCapital > 0 ? ((totalCapital - prevCapital) / prevCapital) * 100 : 0;

  const row: Record<string, string> = {
    summary_id: `ISUM-${d.replace(/-/g, '')}`,
    date: d,
    total_revenue: String(totalRevenue),
    total_profit: String(totalProfit),
    total_capital: String(totalCapital),
    active_investors: String(active),
    dividend_declared: String(totalDividend),
    growth_pct: growth.toFixed(2),
    created_at: nowTimestampWib(),
  };

  const existing = await findRow(TABS.summary, 'summary_id', row.summary_id);
  if (existing) await updateRow(TABS.summary, existing.rowNumber, row);
  else await appendRows(TABS.summary, [row]);

  // also refresh dashboard tab
  const dash = {
    period: d,
    total_revenue: String(totalRevenue),
    total_profit: String(totalProfit),
    total_capital: String(totalCapital),
    active_investors: String(active),
    dividend_declared: String(totalDividend),
    dividend_paid: String(
      dividend.filter((x) => (x.status || '').toLowerCase() === 'paid').reduce((s, x) => s + Number(x.amount || 0), 0)
    ),
    created_at: nowTimestampWib(),
  };
  await appendRows(TABS.dashboard, [dash]).catch(() => null);

  // fire alerts
  await writeInvestorAlerts(row, shareholding.length);

  return row;
}

export async function writeInvestorAlerts(
  summary: Record<string, string>,
  holdingsCount: number
): Promise<number> {
  const alerts: Record<string, string>[] = [];
  const capital = Number(summary.total_capital || 0);
  const dividend = Number(summary.dividend_declared || 0);
  const growth = Number(summary.growth_pct || 0);
  const now = nowTimestampWib();
  const date = summary.date || todayWib();

  if (capital > 0 && dividend / capital > 0.3) {
    alerts.push({
      alert_id: nextSequentialIdSync('IAL'),
      date,
      severity: 'HIGH',
      alert_type: 'DIVIDEND_HIGH_RATIO',
      title: 'Dividend vs capital tinggi',
      message: `Dividend declared ${dividend} ≈ ${((dividend / capital) * 100).toFixed(1)}% of capital ${capital}`,
      outlet_id: '',
      status: 'OPEN',
      created_at: now,
    });
  }
  if (growth < -10) {
    alerts.push({
      alert_id: nextSequentialIdSync('IAL'),
      date,
      severity: 'MEDIUM',
      alert_type: 'CAPITAL_DROP',
      title: 'Capital growth negatif',
      message: `Growth ${growth}% vs previous summary`,
      outlet_id: '',
      status: 'OPEN',
      created_at: now,
    });
  }
  if (holdingsCount === 0) {
    alerts.push({
      alert_id: nextSequentialIdSync('IAL'),
      date,
      severity: 'LOW',
      alert_type: 'NO_HOLDINGS',
      title: 'Belum ada shareholding',
      message: 'Investor shareholding table empty',
      outlet_id: '',
      status: 'OPEN',
      created_at: now,
    });
  }

  if (alerts.length) {
    const mapped = alerts.map((a) => ({
      alert_id: a.alert_id,
      date: a.date,
      source_app: 'investor',
      alert_type: a.alert_type,
      severity: a.severity,
      message: `${a.title}: ${a.message}`,
      status: a.status,
      created_at: a.created_at,
      resolved_at: '',
    }));
    await appendRows(TABS.hermezAlerts, mapped).catch(() => null);
  }
  return alerts.length;
}
