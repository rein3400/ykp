/**
 * Investor alert rules → investor_hermes_alert_log. Pure evaluation — the
 * regenerate route feeds sheet rows in, this module returns candidates.
 *
 * Rules (kept minimal and honest — the investor app has no threshold-config
 * tab like finance, so thresholds are documented constants here):
 *
 *   1. DIVIDEND_OVERDUE  dividend declared but still unpaid past its due
 *      date → HIGH, one per dividend (entity-scoped ID, created once).
 *      The dividend tab has no due_date column, so the due date is derived:
 *      declared_at + DIVIDEND_PAYMENT_TERMS_DAYS.
 *   2. CAPITAL_OUTFLOW   same-day capital 'out' total above
 *      CAPITAL_OUTFLOW_THRESHOLD_IDR → MEDIUM, one per date.
 *   3. data_missing      finance cross-read (fin_daily_summary) has no row
 *      for the summary date (finance sheet unreachable or not yet closed)
 *      → LOW, one per date.
 */
import { invDailyAlertId, invEntityAlertId } from './id-gen';
import { addDays, datePart, num } from './investor-summary';
import { formatIdr } from './format';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InvestorAlertType = 'DIVIDEND_OVERDUE' | 'CAPITAL_OUTFLOW' | 'data_missing';

/** Declared dividends are due this many days after declared_at. */
export const DIVIDEND_PAYMENT_TERMS_DAYS = 30;

/** Same-day capital outflow total above this triggers CAPITAL_OUTFLOW. */
export const CAPITAL_OUTFLOW_THRESHOLD_IDR = 100_000_000; // Rp 100 juta

export interface InvestorAlertCandidate {
  alertType: InvestorAlertType;
  severity: AlertSeverity;
  message: string;
  /** Set for entity-scoped rules (dividend_id) → date-independent alert ID. */
  referenceId?: string;
}

export interface InvestorRuleInput {
  date: string;
  capital: Record<string, string>[];
  dividend: Record<string, string>[];
  /** Finance cross-read rows matched to the summary date (0 ⇒ missing). */
  financeRowsForDate: number;
}

export function evaluateInvestorAlerts(input: InvestorRuleInput): InvestorAlertCandidate[] {
  const out: InvestorAlertCandidate[] = [];

  // 1. Declared-but-unpaid dividend past due date (declared_at + terms).
  for (const d of input.dividend) {
    if (d.status !== 'declared') continue;
    const declared = datePart(d.declared_at);
    if (!declared) continue;
    const dueDate = addDays(declared, DIVIDEND_PAYMENT_TERMS_DAYS);
    if (dueDate >= input.date) continue;
    const overdueDays = Math.round(
      (new Date(`${input.date}T00:00:00Z`).getTime() - new Date(`${dueDate}T00:00:00Z`).getTime()) / 86_400_000
    );
    out.push({
      alertType: 'DIVIDEND_OVERDUE',
      severity: 'HIGH',
      referenceId: d.dividend_id,
      message: `Dividend ${d.dividend_id} (${d.investor_id}) sebesar ${formatIdr(num(d.amount))} ` +
        `di-declare ${declared}, jatuh tempo ${dueDate}, belum dibayar (${overdueDays} hari lewat).`
    });
  }

  // 2. Same-day capital outflow above threshold.
  const outflow = input.capital
    .filter((c) => c.type === 'out' && c.date === input.date)
    .reduce((s, c) => s + num(c.amount), 0);
  if (outflow > CAPITAL_OUTFLOW_THRESHOLD_IDR) {
    out.push({
      alertType: 'CAPITAL_OUTFLOW',
      severity: 'MEDIUM',
      message: `Capital outflow ${formatIdr(outflow)} pada ${input.date} melebihi threshold ` +
        `${formatIdr(CAPITAL_OUTFLOW_THRESHOLD_IDR)}.`
    });
  }

  // 3. Finance cross-read has no row for the summary date.
  if (input.financeRowsForDate === 0) {
    out.push({
      alertType: 'data_missing',
      severity: 'LOW',
      message: `Finance cross-read (fin_daily_summary) tidak punya data untuk ${input.date}; ` +
        `total_revenue/total_profit summary = 0.`
    });
  }

  return out;
}

/**
 * Deterministic alert ID for a candidate: entity-scoped when referenceId is
 * set (created once per entity), otherwise date-scoped (one per date+rule).
 */
export function alertIdFor(candidate: InvestorAlertCandidate, date: string): string {
  return candidate.referenceId
    ? invEntityAlertId(candidate.alertType, candidate.referenceId)
    : invDailyAlertId(date, candidate.alertType);
}
