/**
 * Server-side aggregation: fetch every module's PUBLIC endpoints in
 * parallel, normalize into one OwnerOverview. Per-module failure
 * isolation: a dead module turns its tile OFFLINE, the rest still render.
 * READ-ONLY — this file contains no write paths by design.
 */
import type { ModuleKey, OwnerAction, OwnerAlert, OwnerOverview, SummaryRow } from './types';
import { MODULE_KEYS } from './types';
import { MODULES, moduleUrl, type ModuleDef } from './modules';
import { fetchJson, extractItems, extractCount } from './fetch';
import { computeModuleStatus, latestSummaryDate } from './status';
import {
  alertFromModuleRow, actionFromModuleRow, alertsFromSummary, isOpenStatus, sortAlerts
} from './alerts';
import { buildHeadline } from './consolidate';
import { todayWib, num } from './format';
import { mockOverview } from './mock';

export function isMockForced(): boolean {
  return (process.env.YKP_OWNER_MOCK ?? '').toLowerCase() === 'true';
}

function dateDaysAgo(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchModuleSummary(def: ModuleDef, today: string): Promise<{
  reachable: boolean; latencyMs: number | null; rows: SummaryRow[]; error: string | null;
}> {
  const path = def.summaryPath.replace('TODAY', today);
  const res = await fetchJson(moduleUrl(def, path));
  if (!res.ok) {
    return { reachable: false, latencyMs: res.latencyMs, rows: [], error: res.error };
  }
  return { reachable: true, latencyMs: res.latencyMs, rows: extractItems(res.data), error: null };
}

async function fetchModuleCount(def: ModuleDef): Promise<number | null> {
  if (!def.countPath) return null;
  const res = await fetchJson(moduleUrl(def, def.countPath));
  return res.ok ? extractCount(res.data) : null;
}

/**
 * Fetch a module's public alerts / actions / purchase-recommendation
 * endpoints (whichever the module exposes — see MODULES.*Path). Modules
 * without a path simply skip; a failing endpoint degrades to
 * alertsUnavailable so the UI can fall back to summary-derived alerts.
 */
async function fetchModuleExtras(def: ModuleDef, today: string): Promise<{
  alerts: OwnerAlert[]; alertsUnavailable: boolean; actions: OwnerAction[]; purchaseRecs: SummaryRow[];
}> {
  const alertsLink = moduleUrl(def, def.pages.alerts);
  const actionsLink = moduleUrl(def, def.pages.actions);
  const [alertsRes, actionsRes, purchaseRes] = await Promise.all([
    def.alertsPath ? fetchJson(moduleUrl(def, def.alertsPath)) : Promise.resolve(null),
    def.actionsPath ? fetchJson(moduleUrl(def, def.actionsPath)) : Promise.resolve(null),
    def.purchasePath ? fetchJson(moduleUrl(def, def.purchasePath)) : Promise.resolve(null)
  ]);

  let alerts: OwnerAlert[] = [];
  let alertsUnavailable = false;
  if (alertsRes) {
    if (alertsRes.ok) {
      alerts = extractItems(alertsRes.data)
        .filter((r) => isOpenStatus(r.status ?? 'OPEN'))
        .map((r) => alertFromModuleRow(r, def.key, alertsLink));
    } else {
      // Middleware allows public GET but the handler may still 401 — degrade.
      alertsUnavailable = true;
    }
  }

  let actions: OwnerAction[] = [];
  if (actionsRes?.ok) {
    actions = extractItems(actionsRes.data)
      .filter((r) => isOpenStatus(r.status ?? 'OPEN'))
      .map((r) => actionFromModuleRow(r, def.key, actionsLink, today));
  }

  const purchaseRecs = purchaseRes?.ok
    ? extractItems(purchaseRes.data).filter(
        (r) => (r.recommendation_status ?? '').toUpperCase() === 'PENDING'
      )
    : [];
  return { alerts, alertsUnavailable, actions, purchaseRecs };
}

/** 7-day average net_sales from per-day finance summary fetches. */
async function fetchFinance7dAvg(def: ModuleDef, today: string): Promise<number | null> {
  const dates = Array.from({ length: 7 }, (_, i) => dateDaysAgo(today, i + 1));
  const results = await Promise.all(
    dates.map((d) => fetchJson(moduleUrl(def, `/api/finance/summary?date=${d}`), 3000))
  );
  const totals: number[] = [];
  for (const r of results) {
    if (!r.ok) continue;
    const rows = extractItems(r.data);
    if (rows.length) totals.push(rows.reduce((s, row) => s + num(row.net_sales), 0));
  }
  if (!totals.length) return null;
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

export async function getOverview(): Promise<OwnerOverview> {
  if (isMockForced()) return mockOverview(new Date(), true);

  const today = todayWib();

  // Phase 1: summaries in parallel (each isolated).
  const summaryResults = await Promise.all(
    MODULE_KEYS.map((k) => fetchModuleSummary(MODULES[k], today))
  );
  const anyReachable = summaryResults.some((r) => r.reachable);

  // All modules unreachable → full mock fallback so the demo still works.
  if (!anyReachable) return mockOverview(new Date(), false);

  // Phase 2: counts + per-module extras (alerts/actions/purchase recs) +
  // finance 7d history, in parallel.
  const [counts, extrasResults, fin7d] = await Promise.all([
    Promise.all(MODULE_KEYS.map((k) => fetchModuleCount(MODULES[k]))),
    Promise.all(MODULE_KEYS.map((k) => fetchModuleExtras(MODULES[k], today))),
    summaryResults[0].reachable ? fetchFinance7dAvg(MODULES.finance, today) : Promise.resolve(null)
  ]);

  const modules = {} as OwnerOverview['modules'];
  MODULE_KEYS.forEach((k, i) => {
    const def = MODULES[k];
    const s = summaryResults[i];
    const summaryDate = latestSummaryDate(s.rows);
    const extras = extrasResults[i];
    modules[k] = {
      key: k,
      label: def.label,
      status: computeModuleStatus({ mock: false, reachable: s.reachable, summaryDate, today }),
      reachable: s.reachable,
      latencyMs: s.latencyMs,
      summaryDate,
      rows: s.rows,
      recordCount: counts[i],
      alerts: extras.alerts,
      alertsUnavailable: extras.alertsUnavailable,
      actions: extras.actions,
      purchaseRecs: extras.purchaseRecs,
      error: s.error,
      deepLink: moduleUrl(def, def.pages.home)
    };
  });

  // Merge alerts: endpoint alerts (warehouse/finance/ops public GET) +
  // summary-derived alerts for modules whose endpoint answered nothing
  // (dedup by id; summary alerts skipped when the endpoint answered to
  // avoid double counting).
  const alertLists: OwnerAlert[][] = [];
  for (const k of MODULE_KEYS) {
    const m = modules[k];
    if (!m.reachable) continue;
    const link = moduleUrl(MODULES[k], MODULES[k].pages.alerts);
    if (m.alerts.length > 0) {
      alertLists.push(m.alerts);
    } else {
      alertLists.push(alertsFromSummary(k as ModuleKey, m.rows, link));
    }
  }
  const alerts = sortAlerts(alertLists.flat());

  const actions = sortActions(MODULE_KEYS.flatMap((k) => modules[k].actions));

  const headline = buildHeadline({
    finance: modules.finance.rows,
    financePrev: [],
    hr: modules.hr.rows,
    warehouse: modules.warehouse.rows,
    alerts
  });
  headline.revenue7dAvg = fin7d;

  return {
    date: today,
    generatedAt: new Date().toISOString(),
    mock: false,
    mockForced: false,
    modules,
    alerts,
    actions,
    headline
  };
}

/** Fetch finance summary rows for a specific date (public endpoint). */
export async function getFinanceRowsOn(date: string): Promise<SummaryRow[]> {
  if (isMockForced()) {
    const ov = mockOverview(new Date());
    return ov.modules.finance.rows.map((r) => ({ ...r, date }));
  }
  const res = await fetchJson(moduleUrl(MODULES.finance, `/api/finance/summary?date=${date}`));
  return res.ok ? extractItems(res.data) : [];
}

/** OVERDUE first, then by due date ascending. */
export function sortActions(actions: OwnerAction[]): OwnerAction[] {
  return [...actions].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  });
}
