/**
 * @ykp/engine/triggers
 *
 * The 7 Hermez alert rule functions. Each rule receives a summary row +
 * config thresholds and returns a trigger decision. Keep rules pure so
 * unit testing is trivial; no DB access inside individual rules.
 *
 * Trigger numbering (binding contract §7.2):
 *   1. lateStaffTrigger
 *   2. cashDiffTrigger
 *   3. supplierOverdueTrigger
 *   4. pettyCashAnomalyTrigger
 *   5. highExpenseTrigger
 *   6. schemaMismatchTrigger
 *   7. dataMissingTrigger
 */

import { formatIdr } from "../../format/src/index";

export type TriggerSeverity = "warning" | "critical";

export interface TriggerDecision {
  fire: boolean;
  severity: TriggerSeverity;
  message: string;
}

export interface LateStaffConfig {
  lateCountThreshold: number;
  /** 0-1 fraction, e.g. 0.2 means >20% of present staff late. */
  lateRatioThreshold: number;
  /** Ratio at which the alert escalates from warning to critical. Defaults to 0.5. */
  criticalRatioThreshold?: number;
}

export function lateStaffTrigger(
  summary: { staffLate: number; staffPresent: number; payrollIssue?: string | null },
  config: LateStaffConfig,
): TriggerDecision {
  const present = Math.max(summary.staffPresent, 1);
  const ratio = summary.staffLate / present;
  const criticalRatio = config.criticalRatioThreshold ?? 0.5;
  if (summary.staffLate >= config.lateCountThreshold || ratio > config.lateRatioThreshold) {
    return {
      fire: true,
      severity: ratio > criticalRatio ? "critical" : "warning",
      message: `${summary.staffLate} karyawan terlambat (${(ratio * 100).toFixed(0)}% shift hari ini). Cek jadwal dan PIC outlet.`,
    };
  }
  return { fire: false, severity: "warning", message: "" };
}

export interface CashDiffConfig {
  /** Absolute IDR threshold to alert. */
  threshold: number;
  /** Absolute IDR threshold at which the alert escalates to critical. */
  criticalThreshold: number;
  /** If cash difference exceeds this percentage of revenue, escalate. */
  pctOfRevenueThreshold?: number;
}

export function cashDiffTrigger(
  summary: { cashDifference: number; revenue: number },
  config: CashDiffConfig,
): TriggerDecision {
  const absDiff = Math.abs(summary.cashDifference);
  if (absDiff === 0) return { fire: false, severity: "warning", message: "" };
  if (absDiff >= config.threshold) {
    const pct = summary.revenue > 0 ? absDiff / summary.revenue : 0;
    // Defect Z3 fix: escalation threshold comes from the seeded
    // hermez_config `cash_diff_critical` (config.criticalThreshold), not
    // from a heuristic `threshold * 5` that silently drifted from the
    // business requirement (200k, not 250k).
    const severe =
      pct >= (config.pctOfRevenueThreshold ?? 0.05) || absDiff >= config.criticalThreshold;
    return {
      fire: true,
      severity: severe ? "critical" : "warning",
      message: `Selisih kas ${formatIdr(summary.cashDifference)} (±${(pct * 100).toFixed(1)}% revenue). Rekonsiliasi segera.`,
    };
  }
  return { fire: false, severity: "warning", message: "" };
}

export interface SupplierOverdueConfig {
  unpaidThreshold: number;
  /** Alert if the supplier balance has been unpaid for N+ days. */
  overdueDaysThreshold: number;
}

export function supplierOverdueTrigger(
  summary: { unpaidSupplier: number; oldestUnpaidDays?: number },
  config: SupplierOverdueConfig,
): TriggerDecision {
  if (summary.unpaidSupplier <= 0) return { fire: false, severity: "warning", message: "" };
  const overdue = (summary.oldestUnpaidDays ?? 0) >= config.overdueDaysThreshold;
  const large = summary.unpaidSupplier >= config.unpaidThreshold;
  if (overdue || large) {
    return {
      fire: true,
      severity: overdue && large ? "critical" : "warning",
      message: `Tagihan supplier tertunggak ${formatIdr(summary.unpaidSupplier)}. Risiko operasional.`,
    };
  }
  return { fire: false, severity: "warning", message: "" };
}

export interface PettyCashConfig {
  /** Daily petty-cash-out IDR threshold. */
  dailyThreshold: number;
  /** Alert if petty cash out exceeds this ratio of revenue. */
  ratioThreshold?: number;
  /**
   * 7-day moving average of petty cash out for the outlet. When provided
   * alongside `movingAverageMultiplier`, the trigger fires if today's
   * petty cash out exceeds the moving average times this multiplier.
   * Falls back to the static thresholds when omitted.
   */
  movingAverage7d?: number;
  movingAverageMultiplier?: number;
}

export function pettyCashAnomalyTrigger(
  summary: { pettyCashOut: number; revenue: number; outlet?: string | null },
  config: PettyCashConfig,
): TriggerDecision {
  if (config.dailyThreshold <= 0) return { fire: false, severity: "warning", message: "" };
  const ratio = summary.revenue > 0 ? summary.pettyCashOut / summary.revenue : 0;

  // Moving average branch (preferred per binding contract §7.2.4).
  const movingAverage = config.movingAverage7d;
  const multiplier = config.movingAverageMultiplier;
  if (movingAverage !== undefined && multiplier !== undefined && movingAverage > 0) {
    const overAverage = summary.pettyCashOut > movingAverage * multiplier;
    if (overAverage) {
      const exceedPct = ((summary.pettyCashOut - movingAverage) / movingAverage) * 100;
      return {
        fire: true,
        severity: exceedPct >= 100 ? "critical" : "warning",
        message: `Petty cash keluar ${formatIdr(summary.pettyCashOut)} (>${(multiplier).toFixed(2)}× moving avg 7 hari ${formatIdr(Math.round(movingAverage))}, +${exceedPct.toFixed(0)}%). Cek approval dan struk.`,
      };
    }
  }

  if (summary.pettyCashOut >= config.dailyThreshold || ratio >= (config.ratioThreshold ?? 0.1)) {
    return {
      fire: true,
      severity: ratio >= (config.ratioThreshold ?? 0.1) * 2 ? "critical" : "warning",
      message: `Petty cash keluar ${formatIdr(summary.pettyCashOut)} (${(ratio * 100).toFixed(1)}% revenue). Cek approval dan struk.`,
    };
  }
  return { fire: false, severity: "warning", message: "" };
}

export interface HighExpenseConfig {
  /**
   * Multiplier of today's revenue: alert when expense > revenue × multiplier.
   * Default 1.2 per binding contract §7.2.5 (high_expense_multiplier).
   */
  expenseMultiplier?: number;
  /** @deprecated prefer `expenseMultiplier`. Retained for back-compat reading from older hermez_config rows. */
  expenseToRevenueThreshold?: number;
  /** Hard absolute IDR threshold. */
  absoluteThreshold?: number;
}

export function highExpenseTrigger(
  summary: { expense: number; revenue: number },
  config: HighExpenseConfig,
): TriggerDecision {
  const ratio = summary.revenue > 0 ? summary.expense / summary.revenue : 0;
  // Resolve effective ratio threshold: prefer high_expense_multiplier (1.2),
  // fall back to legacy expenseToRevenueThreshold so existing config rows
  // continue to work.
  const ratioThreshold =
    config.expenseMultiplier ?? config.expenseToRevenueThreshold ?? 1.2;
  const overAbsolute =
    config.absoluteThreshold !== undefined && summary.expense >= config.absoluteThreshold;
  if (ratio >= ratioThreshold || overAbsolute) {
    return {
      fire: true,
      severity: ratio >= ratioThreshold * 1.34 ? "critical" : "warning",
      message: `Expense ${formatIdr(summary.expense)} (${(ratio * 100).toFixed(1)}% revenue). Evaluasi pengeluaran hari ini.`,
    };
  }
  return { fire: false, severity: "warning", message: "" };
}

export interface SchemaMismatchConfig {
  /** Not used by the simple rule, kept for future strict mode. */
  enabled?: boolean;
}

export function schemaMismatchTrigger(
  summary: { schemaErrors?: string[] },
  _config: SchemaMismatchConfig,
): TriggerDecision {
  if (!summary.schemaErrors?.length) return { fire: false, severity: "warning", message: "" };
  return {
    fire: true,
    severity: "critical",
    message: `Data master tidak sinkron: ${summary.schemaErrors.slice(0, 3).join("; ")}. Periksa referensi brand/outlet/supplier/employee.`,
  };
}

export interface DataMissingConfig {
  /** If any of these summary fields are null/undefined/missing, trigger. */
  requiredFields?: ReadonlyArray<keyof { revenue: number; expense: number; supplierCost: number; pettyCashOut: number }>;
}

/** Aggregate trigger configuration consumed by generateBriefForDate. */
export interface TriggerConfig {
  late: LateStaffConfig;
  cash: CashDiffConfig;
  supplier: SupplierOverdueConfig;
  pettyCash: PettyCashConfig;
  expense: HighExpenseConfig;
  schema: SchemaMismatchConfig;
  dataMissing: DataMissingConfig;
}

/**
 * Default trigger configuration used when hermez_config rows are missing.
 * Exported so hermez-brief.ts can merge it with DB overrides consistently.
 */
export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  late: { lateCountThreshold: 3, lateRatioThreshold: 0.2, criticalRatioThreshold: 0.5 },
  // Defect Z3 fix: default criticalThreshold seeded at 200k so the cash
  // diff critical threshold is not silently overridden by `threshold * 5`.
  cash: { threshold: 50_000, criticalThreshold: 200_000, pctOfRevenueThreshold: 0.05 },
  supplier: { unpaidThreshold: 1_000_000, overdueDaysThreshold: 7 },
  pettyCash: { dailyThreshold: 500_000, ratioThreshold: 0.1, movingAverageMultiplier: 1.5 },
  expense: { expenseMultiplier: 1.2, absoluteThreshold: 5_000_000 },
  schema: { enabled: true },
  dataMissing: { requiredFields: ["revenue", "expense", "supplierCost", "pettyCashOut"] },
};

export function dataMissingTrigger(
  summary: Partial<{
    revenue: number;
    expense: number;
    supplierCost: number;
    pettyCashOut: number;
  }>,
  config: DataMissingConfig = { requiredFields: ["revenue", "expense", "supplierCost", "pettyCashOut"] },
): TriggerDecision {
  const missing = (config.requiredFields ?? []).filter((field) => {
    const v = summary[field];
    return v === undefined || v === null || Number.isNaN(v);
  });
  if (!missing.length) return { fire: false, severity: "warning", message: "" };
  return {
    fire: true,
    severity: "warning",
    message: `Data laporan belum lengkap untuk: ${missing.join(", ")}. Input HR/Finance hari ini perlu dilengkapi.`,
  };
}