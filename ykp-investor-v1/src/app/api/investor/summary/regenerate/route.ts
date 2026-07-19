/**
 * POST /api/investor/summary/regenerate
 * Session-protected, owner role only (same pattern as capital/dividend POST).
 *
 * Recomputes investor_daily_summary for one date (default: today WIB) from
 * investor_capital / investor_dividend / investor_shareholding /
 * master_investor plus the finance cross-read (fin_daily_summary), upserts
 * by deterministic summary_id (idempotent), then evaluates the investor
 * alert rules into investor_hermes_alert_log with deterministic IDs.
 *
 * Newly created HIGH/CRITICAL alerts get an immediate Telegram push
 * (deterministic IDs guarantee re-runs never re-push; MEDIUM/LOW skipped).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, updateRow, findRow, readFinanceTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { computeInvestorSummary, toSummaryRow, type InvestorRows } from '@/lib/investor-summary';
import { evaluateInvestorAlerts, alertIdFor } from '@/lib/investor-alerts';
import { invSummaryId } from '@/lib/id-gen';
import { pushAlertNotification } from '@/lib/telegram';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can regenerate the daily summary');

  const body = (await req.json().catch(() => ({}))) as { date?: string };
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();

  const [investors, capital, shareholding, dividend, existingAlerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.capital),
    readTab<Record<string, string>>(TABS.shareholding),
    readTab<Record<string, string>>(TABS.dividend),
    readTab<Record<string, string>>(TABS.hermezAlerts)
  ]);

  // Finance cross-read is best-effort: unreachable/unconfigured finance
  // yields zero rows and surfaces as a LOW data_missing alert, not a 500.
  let finRows: Record<string, string>[] = [];
  try { finRows = await readFinanceTab<Record<string, string>>('fin_daily_summary'); } catch { /* not configured */ }

  const rows: InvestorRows = { investors, capital, shareholding, dividend };
  const computed = computeInvestorSummary(rows, finRows, date);

  // Upsert the summary row by deterministic summary_id.
  const t = nowTimestampWib();
  const summaryId = invSummaryId(date);
  const summaryRow = toSummaryRow(summaryId, computed, t);
  const existing = await findRow(TABS.summary, 'summary_id', summaryId);
  if (existing) await updateRow(TABS.summary, existing.rowNumber, summaryRow);
  else await appendRows(TABS.summary, [summaryRow]);

  // Evaluate alert rules; dedupe against existing + in-batch by deterministic ID.
  const newAlerts: Record<string, string>[] = [];
  for (const a of evaluateInvestorAlerts({ date, capital, dividend, financeRowsForDate: computed.financeRowsForDate })) {
    const alertId = alertIdFor(a, date);
    if (existingAlerts.some((x) => x.alert_id === alertId)
      || newAlerts.some((x) => x.alert_id === alertId)) continue;
    newAlerts.push({
      alert_id: alertId,
      date,
      source_app: 'investor',
      alert_type: a.alertType,
      severity: a.severity,
      message: a.message,
      status: 'OPEN',
      created_at: t,
      resolved_at: ''
    });
  }
  if (newAlerts.length > 0) await appendRows(TABS.hermezAlerts, newAlerts);

  // Immediate Telegram push for newly created HIGH/CRITICAL alerts only.
  for (const a of newAlerts) {
    await pushAlertNotification('investor', {
      alertId: a.alert_id,
      alertType: a.alert_type,
      severity: a.severity,
      title: a.message,
      message: a.message,
      date: a.date
    });
  }

  await logAudit({
    actorUserId: s.userId, actorRole: s.role, action: 'regenerate',
    entity: 'daily_summary', entityId: summaryId,
    afterValue: JSON.stringify({ date, alerts: newAlerts.length })
  }).catch(() => null);

  return ok({
    date,
    summary_id: summaryId,
    alerts_created: newAlerts.length,
    summary: summaryRow,
    alerts: newAlerts,
    // Transparency context (not persisted to the summary tab).
    context: {
      finance_rows_for_date: computed.financeRowsForDate,
      total_share_value: computed.totalShareValue
    }
  }, 201);
});
