/**
 * Hermez Daily Brief composition — pure functions, vitest-covered.
 * Format per YKP Hermez blueprint §10.4:
 *   Header `YKP Daily Brief - DD MMM YYYY`, sections [Finance] [HR]
 *   [Warehouse] [Ops] [Alerts] (N) [Action besok] (max 5 lines),
 *   alert_level: any CRITICAL → red; any HIGH or data missing → yellow
 *   (minimum); else green.
 * Read-only: the brief is rendered for copy-to-clipboard; the sibling
 * Hermez worker owns actual Telegram delivery.
 */
import type { BriefResult, OwnerOverview, Severity } from './types';
import { formatDateShort, idr } from './format';
import { consolidateFinance, consolidateHr, consolidateOps, consolidateWarehouse } from './consolidate';

/** Highest-severity-wins level, with data-missing forcing at least yellow. */
export function computeAlertLevel(
  severities: Severity[],
  dataMissing: boolean
): 'green' | 'yellow' | 'red' {
  if (severities.includes('CRITICAL')) return 'red';
  if (severities.includes('HIGH') || dataMissing) return 'yellow';
  return 'green';
}

const SEV_TAG: Record<Severity, string> = {
  CRITICAL: 'critical',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'info'
};

export function composeBrief(ov: OwnerOverview): BriefResult {
  const fin = consolidateFinance(ov.modules.finance.rows);
  const hr = consolidateHr(ov.modules.hr.rows);
  const wh = consolidateWarehouse(ov.modules.warehouse.rows);
  const ops = consolidateOps(ov.modules.ops.rows);
  const inv = ov.modules.investor.rows[0];

  const dataMissing = (['finance', 'hr', 'warehouse', 'ops'] as const).some(
    (k) => !ov.modules[k].reachable && !ov.mock
  );

  const lines: string[] = [];
  lines.push(`YKP Daily Brief - ${formatDateShort(ov.date)}`);

  // [Finance]
  lines.push('', '[Finance]');
  if (ov.modules.finance.rows.length) {
    lines.push(`- Total revenue: ${idr(fin.revenue)}`);
    lines.push(`- Total expense: ${idr(fin.expense)}`);
    lines.push(`- Estimasi surplus kas: ${idr(fin.estimasiSurplus)}`);
    lines.push(`- Unpaid supplier: ${idr(fin.unpaidSupplier)}`);
  } else {
    lines.push('- none');
  }

  // [HR]
  lines.push('', '[HR]');
  if (ov.modules.hr.rows.length) {
    lines.push(
      `- Total staff: ${hr.scheduled} | Present: ${hr.present} | Late: ${hr.late} | Absent: ${hr.absent}`
    );
    if (hr.shiftShortage > 0) lines.push(`- Shift shortage: ${hr.shiftShortage}`);
  } else {
    lines.push('- none');
  }

  // [Warehouse]
  lines.push('', '[Warehouse]');
  if (ov.modules.warehouse.rows.length) {
    lines.push(`- Nilai inventori: ${idr(wh.inventoryValue)}`);
    lines.push(`- Stok kritis: ${wh.criticalLowStock} | Near expiry: ${wh.nearExpiry} | Expired: ${wh.expired}`);
    if (wh.pendingPurchaseRecs > 0) {
      lines.push(`- Purchase recommendation pending: ${wh.pendingPurchaseRecs} (${idr(wh.estimatedPurchaseValue)})`);
    }
  } else {
    lines.push('- none');
  }

  // [Ops]
  lines.push('', '[Ops]');
  if (ov.modules.ops.rows.length) {
    lines.push(`- Outlet siap: ${ops.outletsReady}/${ops.outletsTotal} | Checklist: ${ops.avgChecklist}%`);
    lines.push(`- Insiden: ${ops.openIncidents} (berat: ${ops.highSeverityIncidents})`);
    if (ops.cashDifference !== 0) lines.push(`- Selisih kas: ${idr(ops.cashDifference)}`);
  } else {
    lines.push('- none');
  }

  // [Investor] — one compact line when the module answers
  if (inv) {
    lines.push('', '[Investor]');
    lines.push(`- Revenue: ${idr(Number(inv.total_revenue ?? 0) || 0)} | Profit: ${idr(Number(inv.total_profit ?? 0) || 0)} | Dividend declared: ${idr(Number(inv.dividend_declared ?? 0) || 0)}`);
  }

  // [Alerts] (N)
  lines.push('', `[Alerts] (${ov.alerts.length})`);
  if (ov.alerts.length === 0) {
    lines.push('- none');
  } else {
    for (const a of ov.alerts.slice(0, 10)) {
      lines.push(`- [${SEV_TAG[a.severity]}] ${(a.message || a.title).trim()}`);
    }
    if (ov.alerts.length > 10) lines.push(`- … +${ov.alerts.length - 10} lainnya`);
  }

  // [Action besok] — combined recommended_action + top criticals, max 5 lines
  lines.push('', '[Action besok]');
  const actions: string[] = [];
  for (const k of ['finance', 'hr', 'warehouse', 'ops'] as const) {
    for (const r of ov.modules[k].rows) {
      const rec = r.recommended_action;
      if (rec && !actions.includes(rec)) actions.push(rec);
    }
  }
  for (const a of ov.actions.filter((x) => x.overdue)) {
    const label = `${a.title} (${a.pic || a.module})`;
    if (!actions.includes(label)) actions.push(label);
  }
  if (actions.length === 0) lines.push('- none');
  else for (const a of actions.slice(0, 5)) lines.push(`- ${a}`);

  const level = computeAlertLevel(ov.alerts.map((a) => a.severity), dataMissing);
  // Level line sits directly under the header per blueprint template.
  lines.splice(1, 0, `Level: ${level.toUpperCase()}`);

  return { text: lines.join('\n'), alertLevel: level, alertCount: ov.alerts.length };
}
