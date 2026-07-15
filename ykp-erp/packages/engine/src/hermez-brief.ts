/**
 * @fileoverview Hermez daily brief generator.
 *
 * Hermez daily brief generator. Reads hr_daily_summary + fin_daily_summary
 * for date H across all outlets, validates brand/outlet against master,
 * runs the 7 triggers, composes an Indonesian multiline brief, and writes
 * hermez_daily_brief + hermez_alert_log.
 *
 * Boundary rules:
 *   - NO writes to hr or finance tables.
 *   - Reads only from hr/finance/master + writes hermez_*.
 *   - Upserts on (date) for the brief and dedupes alerts on alert_id.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  hrDailySummary,
  finDailySummary,
  hermezDailyBrief,
  hermezAlertLog,
  hermezConfig,
  type HrDailySummary,
  type FinDailySummary,
  type HermezDailyBrief,
  type HermezAlertLog,
} from "@ykp/schema";
import { formatIdr, formatDateWib } from "@ykp/format";
import { getBrandName, getOutletName } from './lookup';
import { hermezBriefId, hermezAlertId } from './id-gen';
import {
  lateStaffTrigger,
  cashDiffTrigger,
  supplierOverdueTrigger,
  pettyCashAnomalyTrigger,
  highExpenseTrigger,
  schemaMismatchTrigger,
  dataMissingTrigger,
  DEFAULT_TRIGGER_CONFIG,
  type TriggerConfig,
} from './triggers';
import type { TriggerDecision } from './triggers';

type AnyDb = PostgresJsDatabase<Record<string, unknown>>;

/**
 * Resolve the deployment environment tag.
 * Priority: YKP_ENVIRONMENT > NODE_ENV (mapped) > "PRODUCTION".
 */
function resolveEnvironment(): string {
  const env = process.env.YKP_ENVIRONMENT ?? process.env.NODE_ENV ?? "";
  const upper = env.toUpperCase();
  if (upper === "DEMO" || upper === "TESTING" || upper === "PRODUCTION") return upper;
  if (upper === "DEVELOPMENT") return "DEMO";
  return "PRODUCTION";
}

export interface HermezBriefInput {
  hermezDb: AnyDb;
  hrDb: AnyDb;
  financeDb: AnyDb;
  masterDb: AnyDb;
  date: string; // yyyy-mm-dd
}

export interface HermezBriefResult {
  brief: HermezDailyBrief;
  alerts: HermezAlertLog[];
}

/**
 * Fallback trigger configuration imported from triggers.ts. Kept as an alias
 * here so downstream callers can still use getHermezConfig without change.
 */
const FALLBACK_TRIGGER_CONFIG = DEFAULT_TRIGGER_CONFIG;

/**
 * Load the previous 7 days of fin_daily_summary pettyCashOut per outlet.
 * Used by the petty-cash anomaly trigger to compare today against a moving average.
 * Only reads from finance tables; never writes.
 */
export async function getPettyCashMovingAverage(
  financeDb: AnyDb,
  outletId: string,
  since: Date,
): Promise<number | undefined> {
  const end = since.toISOString().slice(0, 10);
  const startDate = new Date(since);
  startDate.setDate(startDate.getDate() - 7);
  const start = startDate.toISOString().slice(0, 10);
  const rows = await financeDb
    .select({ pettyCashOut: finDailySummary.pettyCashOut })
    .from(finDailySummary)
    .where(
      and(
        // Defect H2/Z1 fix: filter by outletId (ID column) instead of outlet
        // (NAME). Matches the rest of the lookup-by-id pipeline.
        eq(finDailySummary.outletId, outletId),
        gte(finDailySummary.date, new Date(start)),
        lt(finDailySummary.date, new Date(end)),
      ),
    );
  if (!rows.length) return undefined;
  const values = rows.map((r) => Number(r.pettyCashOut ?? 0)).filter((n) => Number.isFinite(n));
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Read trigger thresholds from hermez_config. Unknown keys are ignored. */
export async function getHermezConfig(hermezDb: AnyDb): Promise<TriggerConfig> {
  const rows = await hermezDb.select({ key: hermezConfig.key, value: hermezConfig.value }).from(hermezConfig);
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  return {
    late: {
      lateCountThreshold: Number(v.late_count_threshold ?? FALLBACK_TRIGGER_CONFIG.late.lateCountThreshold),
      // Defect Z1 fix: use seed-style key name late_staff_warning_ratio.
      lateRatioThreshold: Number(v.late_staff_warning_ratio ?? FALLBACK_TRIGGER_CONFIG.late.lateRatioThreshold),
      criticalRatioThreshold: Number(v.late_staff_critical_ratio ?? FALLBACK_TRIGGER_CONFIG.late.criticalRatioThreshold ?? 0.5),
    },
    cash: {
      // Defect Z1/Z3 fix: seed-style keys cash_diff_warning (threshold) +
      // cash_diff_critical (escalation threshold). pct falls back to default.
      threshold: Number(v.cash_diff_warning ?? FALLBACK_TRIGGER_CONFIG.cash.threshold),
      criticalThreshold: Number(
        v.cash_diff_critical ?? FALLBACK_TRIGGER_CONFIG.cash.criticalThreshold,
      ),
      pctOfRevenueThreshold: Number(v.cash_diff_pct_threshold ?? FALLBACK_TRIGGER_CONFIG.cash.pctOfRevenueThreshold),
    },
    supplier: {
      unpaidThreshold: Number(v.supplier_unpaid_threshold ?? FALLBACK_TRIGGER_CONFIG.supplier.unpaidThreshold),
      overdueDaysThreshold: Number(v.supplier_overdue_days ?? FALLBACK_TRIGGER_CONFIG.supplier.overdueDaysThreshold),
    },
    pettyCash: {
      dailyThreshold: Number(v.petty_cash_daily_threshold ?? FALLBACK_TRIGGER_CONFIG.pettyCash.dailyThreshold),
      ratioThreshold: Number(v.petty_cash_ratio_threshold ?? FALLBACK_TRIGGER_CONFIG.pettyCash.ratioThreshold),
      // Defect Z1 fix: seed-style key petty_cash_anomaly_multiplier.
      movingAverageMultiplier: Number(
        v.petty_cash_anomaly_multiplier ?? FALLBACK_TRIGGER_CONFIG.pettyCash.movingAverageMultiplier ?? 1.5,
      ),
    },
    expense: {
      // Defect Z1 fix: seed-style key high_expense_multiplier.
      expenseMultiplier: Number(v.high_expense_multiplier ?? FALLBACK_TRIGGER_CONFIG.expense.expenseMultiplier ?? 1.2),
      absoluteThreshold: Number(v.expense_absolute_threshold ?? FALLBACK_TRIGGER_CONFIG.expense.absoluteThreshold),
    },
    schema: { enabled: (v.schema_mismatch_enabled ?? "true") === "true" },
    dataMissing: { requiredFields: FALLBACK_TRIGGER_CONFIG.dataMissing.requiredFields },
  };
}

export async function generateBriefForDate(input: HermezBriefInput): Promise<HermezBriefResult> {
  const { hermezDb, hrDb, financeDb, masterDb, date } = input;

  // 0. Load trigger config from hermez_config (or fall back to defaults).
  const triggerConfig = await getHermezConfig(hermezDb);

  // 1. Load all summaries for the day
  const hrRows = await hrDb.select().from(hrDailySummary).where(eq(hrDailySummary.date, new Date(date)));
  const finRows = await financeDb.select().from(finDailySummary).where(eq(finDailySummary.date, new Date(date)));

  // 2. Validate brand/outlet IDs against master.
  // Defect Z1 fix: summary rows now carry brandId + outletId. Validation must
  // resolve master by ID, not by (locale-sensitive, user-editable) name.
  // A missing ID or a name mismatch is recorded as a schema_mismatch error.
  const schemaErrors: string[] = [];
  const validate = async (rows: Array<{ brand: string | null; brandId: string | null; outlet: string | null; outletId: string | null }>) => {
    for (const row of rows) {
      if (!row.brandId) {
        schemaErrors.push(`brand_id missing for summary outlet=${row.outlet ?? "(none)"}`);
      } else {
        const masterBrandName = await getBrandName(masterDb, row.brandId);
        if (masterBrandName === null) {
          schemaErrors.push(`brand_id ${row.brandId} not found in master`);
        } else if (masterBrandName !== row.brand) {
          schemaErrors.push(`brand name mismatch for ${row.brandId}: summary=${row.brand ?? "(none)"}, master=${masterBrandName}`);
        }
      }
      if (!row.outletId) {
        schemaErrors.push(`outlet_id missing for summary brand=${row.brand ?? "(none)"}`);
      } else {
        const masterOutletName = await getOutletName(masterDb, row.outletId);
        if (masterOutletName === null) {
          schemaErrors.push(`outlet_id ${row.outletId} not found in master`);
        } else if (masterOutletName !== row.outlet) {
          schemaErrors.push(`outlet name mismatch for ${row.outletId}: summary=${row.outlet ?? "(none)"}, master=${masterOutletName}`);
        }
      }
    }
  };
  await validate(hrRows);
  await validate(finRows);

  // 3. Run triggers
  const firedAlerts: HermezAlertLog[] = [];
  let alertLevel: "green" | "yellow" | "red" = "green";
  let hasCritical = false;
  // Defect Z8 fix: per-date sequence counter feeding hermezAlertId(date, seq)
  // for contract-compliant HZAL-YYYYMMDD-NNN ids.
  const alertSeqMap = new Map<string, number>();

  const maybeFire = async (
    type: HermezAlertLog["alertType"],
    decision: TriggerDecision,
    outlet?: string,
    brand?: string,
    sourceAppOverride?: HermezAlertLog["sourceApp"],
  ) => {
    if (!decision.fire) return;
    if (decision.severity === "critical") {
      alertLevel = "red";
      hasCritical = true;
    } else if (alertLevel === "green") {
      alertLevel = "yellow";
    }
    // Defect Z8 fix: use hermezAlertId(date, seq) for contract-compliant
    // HZAL-YYYYMMDD-NNN id. Per-date seq counter is in-memory; the unique
    // constraint on (date, outlet, alert_type) handles dedupe across runs.
    const dateKey = date.replace(/-/g, "");
    const next = (alertSeqMap.get(dateKey) ?? 0) + 1;
    alertSeqMap.set(dateKey, next);
    const alertId = hermezAlertId(date, next);
    const defaultSourceApp: HermezAlertLog["sourceApp"] =
      type === "late_staff" ? "hr" : "finance";
    // Defect Z2 fix: global alerts (no outlet) store outlet as "" instead of
    // NULL so the unique index on (date, outlet, alert_type) actually dedupes
    // on re-run. Postgres treats NULLs as distinct, so ON CONFLICT never matched.
    const outletForRow = outlet ?? "";
    const entry: HermezAlertLog = {
      alertId,
      date: new Date(date),
      brand: brand ?? null,
      outlet: outletForRow,
      alertType: type,
      severity: decision.severity,
      message: decision.message,
      sourceApp: sourceAppOverride ?? defaultSourceApp,
      status: "open",
      actionTaken: "none",
      assignedTo: null,
      createdAt: new Date(),
      resolvedAt: null,
      environment: resolveEnvironment(),
    };

    // dedupe by (date, outlet, type) — upsert overwrites the same row.
    await hermezDb
      .insert(hermezAlertLog)
      .values(entry)
      .onConflictDoUpdate({
        target: [hermezAlertLog.date, hermezAlertLog.outlet, hermezAlertLog.alertType],
        set: {
          message: sql`excluded.message`,
          severity: sql`excluded.severity`,
          sourceApp: sql`excluded.source_app`,
          brand: sql`excluded.brand`,
          environment: sql`excluded.environment`,
        },
      });

    firedAlerts.push(entry);
  };

  // Defect Z6 fix: build a set of outlets for which hr_daily_summary exists
  // today. Any active outlet that has finance data but no HR summary is also
  // a "data_missing" situation, fired with sourceApp="hr".
  const hrOutlets = new Set(hrRows.map((r) => r.outlet));

  for (const hr of hrRows) {
    const decision = lateStaffTrigger(hr, triggerConfig.late);
    await maybeFire("late_staff", decision, hr.outlet, hr.brand);
  }

  // Pre-compute the petty-cash 7-day moving average per outlet so the
  // anomaly trigger can compare today's out > mean * multiplier.
  const sinceDate = new Date(date + "T00:00:00+07:00");
  const pettyCashAvgByOutlet = new Map<string, number | undefined>();

  for (const fin of finRows) {
    if (fin.outlet && !pettyCashAvgByOutlet.has(fin.outlet)) {
      const avg = await getPettyCashMovingAverage(financeDb, fin.outlet, sinceDate);
      pettyCashAvgByOutlet.set(fin.outlet, avg);
    }
    const avg = fin.outlet ? pettyCashAvgByOutlet.get(fin.outlet) : undefined;
    await maybeFire("cash_diff", cashDiffTrigger(fin, triggerConfig.cash), fin.outlet, fin.brand);
    await maybeFire(
      "supplier_overdue",
      supplierOverdueTrigger(fin, triggerConfig.supplier),
      fin.outlet,
      fin.brand,
    );
    await maybeFire(
      "petty_cash_anomaly",
      pettyCashAnomalyTrigger(
        fin,
        avg !== undefined
          ? { ...triggerConfig.pettyCash, movingAverage7d: avg }
          : triggerConfig.pettyCash,
      ),
      fin.outlet,
      fin.brand,
    );
    await maybeFire("high_expense", highExpenseTrigger(fin, triggerConfig.expense), fin.outlet, fin.brand);

    // Determine the source app for the data_missing alert based on which
    // summary is actually missing the field. A finance row always exists
    // here, so if the missing field is a finance-only metric (revenue,
    // expense, supplierCost, pettyCashOut) the source is finance. If the
    // missing field maps to an HR metric (attendance/headcount) the source
    // would be hr; if both are missing, both.
    let dataMissingDecision = dataMissingTrigger(fin, triggerConfig.dataMissing);
    let missingSourceApp = resolveDataMissingSourceApp(
      fin,
      hrRows,
      dataMissingDecision,
    );

    // Defect Z6 fix: merge the HR-side "no hr_daily_summary" condition into
    // the same data_missing alert so the (date, outlet, type) unique index
    // does not clobber two separate data_missing rows for one outlet.
    if (fin.outlet && !hrOutlets.has(fin.outlet)) {
      if (!dataMissingDecision.fire) {
        dataMissingDecision = {
          fire: true,
          severity: "warning",
          message: `Data laporan belum lengkap untuk: hr_daily_summary missing for ${fin.outlet}. Input HR hari ini.`,
        };
        missingSourceApp = "hr";
      } else {
        dataMissingDecision.message += `; hr_daily_summary missing for ${fin.outlet}`;
        missingSourceApp = "ops";
      }
    }

    await maybeFire(
      "data_missing",
      dataMissingDecision,
      fin.outlet,
      fin.brand,
      missingSourceApp,
    );
  }

  const schemaDecision = schemaMismatchTrigger({ schemaErrors }, triggerConfig.schema);
  await maybeFire("schema_mismatch", schemaDecision, undefined, undefined);

  // 4. Compose brief text
  const briefText = composeBriefText({
    date,
    hrRows,
    finRows,
    firedAlerts,
    schemaErrors,
    hasCritical,
  });

  const briefId = hermezBriefId(date);
  const briefRow: HermezDailyBrief = {
    briefId,
    date: new Date(date),
    generatedAt: new Date(),
    briefText,
    alertLevel,
    sentToOwner: false,
    sentAt: null,
    environment: resolveEnvironment(),
  };

  await hermezDb
    .insert(hermezDailyBrief)
    .values(briefRow)
    .onConflictDoUpdate({
      target: hermezDailyBrief.date,
      set: {
        briefText: sql`excluded.brief_text`,
        alertLevel: sql`excluded.alert_level`,
        generatedAt: new Date(),
        // Defect Z7 fix: preserve sentToOwner / sentAt on upsert so manual
        // re-runs do not re-notify the owner. If the row was already sent,
        // keep true + the original sentAt; otherwise take the inserted values
        // (which default to false/null).
        sentToOwner: sql`CASE WHEN hermez_daily_brief.sent_to_owner THEN true ELSE excluded.sent_to_owner END`,
        sentAt: sql`CASE WHEN hermez_daily_brief.sent_to_owner THEN hermez_daily_brief.sent_at ELSE excluded.sent_at END`,
      },
    });

  return { brief: briefRow, alerts: firedAlerts };
}

/**
 * Map the data_missing trigger result to the most accurate source app
 * among the values allowed by hermez_alert_source_app enum (hr | finance | ops).
 *
 * Finance metrics: revenue/expense/supplierCost/pettyCashOut.
 * HR metrics: totalStaff/staffPresent/staffLate map to attendance.
 *
 * NOTE: the binding contract mentions a "both" source-app value, but
 * `alertSourceAppEnum` currently only declares hr/finance/ops. Adding
 * "both" requires a schema migration, which is deferred per the fix
 * instructions. Until then, when both sides are missing we emit "ops"
 * (the cross-domain bucket) so the row remains insert-safe. When the
 * enum is extended, switch the `hasFinance && hasHr` branch to "both".
 */
function resolveDataMissingSourceApp(
  fin: FinDailySummary,
  hrRows: HrDailySummary[],
  decision: TriggerDecision,
): HermezAlertLog["sourceApp"] {
  if (!decision.fire) return "finance"; // default, never used because no alert is emitted
  const financeFields = new Set(["revenue", "expense", "supplierCost", "pettyCashOut"]);
  const hrFields = new Set(["totalStaff", "staffPresent", "staffLate"]);
  const missing = decision.message.includes("Data laporan belum lengkap untuk:")
    ? decision.message.split(":").pop()?.trim().split(", ").map((s) => s.trim()) ?? []
    : [];
  let hasFinance = false;
  let hasHr = false;
  for (const field of missing) {
    if (financeFields.has(field)) hasFinance = true;
    if (hrFields.has(field)) hasHr = true;
  }
  // If the decision message doesn't list fields (future shape), infer from the row.
  if (!missing.length) {
    hasFinance =
      fin.revenue === undefined || fin.revenue === null || Number.isNaN(fin.revenue) ||
      fin.expense === undefined || fin.expense === null || Number.isNaN(fin.expense) ||
      fin.supplierCost === undefined || fin.supplierCost === null || Number.isNaN(fin.supplierCost) ||
      fin.pettyCashOut === undefined || fin.pettyCashOut === null || Number.isNaN(fin.pettyCashOut);
    const hr = hrRows.find((r) => r.outlet === fin.outlet && r.brand === fin.brand);
    hasHr =
      !hr ||
      hr.totalStaff === undefined || hr.totalStaff === null || Number.isNaN(hr.totalStaff) ||
      hr.staffPresent === undefined || hr.staffPresent === null || Number.isNaN(hr.staffPresent) ||
      hr.staffLate === undefined || hr.staffLate === null || Number.isNaN(hr.staffLate);
  }
  if (hasFinance && hasHr) return "ops"; // TODO(schema-deferred): return "both" once enum extended.
  if (hasHr) return "hr";
  return "finance";
}

function composeBriefText(ctx: {
  date: string;
  hrRows: HrDailySummary[];
  finRows: FinDailySummary[];
  firedAlerts: HermezAlertLog[];
  schemaErrors: string[];
  hasCritical: boolean;
}): string {
  const { date, hrRows, finRows, firedAlerts, hasCritical } = ctx;
  const totalRevenue = finRows.reduce((acc, r) => acc + r.revenue, 0);
  const totalExpense = finRows.reduce((acc, r) => acc + r.expense, 0);
  const totalNetProfit = finRows.reduce((acc, r) => acc + r.netProfitEstimate, 0);
  const totalStaff = hrRows.reduce((acc, r) => acc + r.totalStaff, 0);
  const staffLate = hrRows.reduce((acc, r) => acc + r.staffLate, 0);

  const lines = [
    `Brief YKP Hermez — ${formatDateWib(new Date(date + "T00:00:00+07:00"))}`,
    ``,
    `Revenue hari ini: ${formatIdr(totalRevenue)}`,
    `Expense hari ini: ${formatIdr(totalExpense)}`,
    `Net profit estimate: ${formatIdr(totalNetProfit)}`,
    `Kehadiran: ${totalStaff - staffLate}/${totalStaff} (terlambat ${staffLate})`,
    ``,
    `Alert aktif: ${firedAlerts.length}${hasCritical ? " — TERDAPAT KRITIS" : ""}`,
    ...firedAlerts.map((a) => `- [${a.severity.toUpperCase()}] ${a.outlet || "global"}: ${a.message}`),
    ``,
    `Level: ${hasCritical ? "RED" : firedAlerts.length ? "YELLOW" : "GREEN"}`,
  ];
  return lines.join("\n");
}
