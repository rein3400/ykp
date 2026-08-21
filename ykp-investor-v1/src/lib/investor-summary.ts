import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { getFinanceTotals } from '@/lib/finance-summary';

/**
 * investor_daily_summary engine — pure functions over sheet rows (no I/O).
 * Mirrors the finance fin-summary.ts pattern: the regenerate route reads
 * tabs, this module computes, the route persists.
 *
 * One summary row per date at GROUP level (there is no outlet dimension —
 * the disclosure model exposes group aggregates only; see GOVERNANCE.md).
 *
 * Columns (TAB_HEADERS[TABS.summary]):
 *   summary_id, date, total_revenue, total_profit, total_capital,
 *   active_investors, dividend_declared, growth_pct, created_at
 *
 * Sources:
 *   - total_revenue / total_profit: finance cross-read (fin_daily_summary)
 *     rows for that exact date. Revenue = net_sales (fallback: revenue);
 *     profit = estimated_surplus (fallback: net_profit_estimate) — the
 *     fallback keys tolerate older/mock finance shapes.
 *   - total_capital: cumulative capital (in — out) with date <= summary date.
 *   - active_investors: master_investor rows with status = 'active'.
 *   - dividend_declared: cumulative declared dividends (status 'declared'
 *     OR 'paid' — paid dividends were also declared) whose declared date
 *     (declared_at, WIB timestamp) <= summary date.
 *   - growth_pct: day-over-day total_revenue growth vs the previous
 *     calendar day, rounded to 1 decimal; empty when the previous day has
 *     no finance revenue baseline (never a fake 0).
 *   - shareholding contributes no persisted column (share_value is a
 *     valuation snapshot, not cash flow — adding it to total_capital would
 *     double count). Its total is returned as response context only.
 */

export interface InvestorRows {
  investors: Record<string, string>[];
  capital: Record<string, string>[];
  shareholding: Record<string, string>[];
  dividend: Record<string, string>[];
}

export interface InvestorSummaryComputed {
  date: string;
  totalRevenue: number;
  totalProfit: number;
  totalCapital: number;
  activeInvestors: number;
  dividendDeclared: number;
  /** null when the previous calendar day has no finance revenue baseline. */
  growthPct: number | null;
  /** Context only — valuation snapshot, NOT written to the summary tab. */
  totalShareValue: number;
  /** Finance rows matched for the date — 0 — data_missing alert. */
  financeRowsForDate: number;
}

export function num(v: string | number | undefined | null): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** First present non-empty numeric field wins (schema-fallback helper). */
export function firstNum(row: Record<string, string>, fields: string[]): number {
  for (const f of fields) {
    const v = row[f];
    if (v !== undefined && v !== '') return num(v);
  }
  return 0;
}

/** Pure date math on YYYY-MM-DD (UTC-anchored, timezone-safe). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Date part of a WIB timestamp ('YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DD'). */
export function datePart(ts: string | undefined | null): string {
  return (ts ?? '').slice(0, 10);
}

export function computeInvestorSummary(
  rows: InvestorRows,
  finRows: Record<string, string>[],
  date: string
): InvestorSummaryComputed {
  const finToday = finRows.filter((r) => r.date === date);
  const finPrev = finRows.filter((r) => r.date === addDays(date, -1));

  const revenueOf = (r: Record<string, string>) => firstNum(r, ['net_sales', 'revenue']);
  const profitOf = (r: Record<string, string>) => firstNum(r, ['estimated_surplus', 'net_profit_estimate']);

  const totalRevenue = finToday.reduce((s, r) => s + revenueOf(r), 0);
  const totalProfit = finToday.reduce((s, r) => s + profitOf(r), 0);
  const prevRevenue = finPrev.reduce((s, r) => s + revenueOf(r), 0);

  const totalCapital = rows.capital
    .filter((c) => c.date && c.date <= date)
    .reduce((s, c) => s + (c.type === 'out' ? -num(c.amount) : num(c.amount)), 0);

  const activeInvestors = rows.investors.filter((i) => i.status === 'active').length;

  const dividendDeclared = rows.dividend
    .filter((d) => {
      const declared = datePart(d.declared_at);
      return declared && declared <= date;
    })
    .reduce((s, d) => s + num(d.amount), 0);

  const totalShareValue = rows.shareholding.reduce((s, r) => s + num(r.share_value), 0);

  const growthPct = prevRevenue > 0
    ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10
    : null;

  return {
    date,
    totalRevenue,
    totalProfit,
    totalCapital,
    activeInvestors,
    dividendDeclared,
    growthPct,
    totalShareValue,
    financeRowsForDate: finToday.length
  };
}

/** Map the computed summary to an investor_daily_summary sheet row. */
export function toSummaryRow(summaryId: string, c: InvestorSummaryComputed, createdAt: string): Record<string, string> {
  return {
    summary_id: summaryId,
    date: c.date,
    total_revenue: String(c.totalRevenue),
    total_profit: String(c.totalProfit),
    total_capital: String(c.totalCapital),
    active_investors: String(c.activeInvestors),
    dividend_declared: String(c.dividendDeclared),
    growth_pct: c.growthPct === null ? '' : String(c.growthPct),
    created_at: createdAt
  };
}

// --- Write pipeline (capital/dividend routes) -----------------------------
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

  // growth vs previous summary if any. Sort by date and take the latest row
  // strictly before today — sheet order is append-order, so out-of-order
  // backfills would otherwise pick an arbitrary baseline (MEDIUM bug).
  const prev = await readTab(TABS.summary);
  const last = prev
    .filter((r) => r.date && r.date < d)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .at(-1);
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
      // No `title` column on investor_hermes_alert_log (TAB_HEADERS); the
      // title is embedded into `message` below (LOW bug — key was dropped).
      message: `Dividend declared ${dividend} — ${((dividend / capital) * 100).toFixed(1)}% of capital ${capital}`,
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
      message: 'Investor shareholding table empty',
      outlet_id: '',
      status: 'OPEN',
      created_at: now,
    });
  }

  if (alerts.length) {
    // Embed the human title into the message text — the alert_log tab has no
    // `title` column (TAB_HEADERS[TABS.hermezAlerts]); writing a title key
    // would be silently dropped (LOW bug).
    const titles: Record<string, string> = {
      DIVIDEND_HIGH_RATIO: 'Dividend vs capital tinggi',
      CAPITAL_DROP: 'Capital growth negatif',
      NO_HOLDINGS: 'Belum ada shareholding',
    };
    const mapped = alerts.map((a) => ({
      alert_id: a.alert_id,
      date: a.date,
      source_app: 'investor',
      alert_type: a.alert_type,
      severity: a.severity,
      message: `${titles[a.alert_type] ?? a.alert_type}: ${a.message}`,
      status: a.status,
      created_at: a.created_at,
      resolved_at: '',
    }));
    await appendRows(TABS.hermezAlerts, mapped).catch(() => null);
  }
  return alerts.length;
}
