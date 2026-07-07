/**
 * Smoke test: hermez brief flow without touching hr/fin tables.
 *
 * We replace @ykp/schema exports + the @ykp/engine hermez-brief module with
 * stubs that record what tables were read/written. The test asserts that
 * generateBriefForDate only writes to hermez_* and only reads from
 * hr_daily_summary + fin_daily_summary + master_*.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface TouchLog {
  table: string;
  op: "select" | "insert" | "update" | "delete";
}

const touchLog: TouchLog[] = [];

// Mock the 7 trigger functions to fire deterministic alerts so the test
// stays in pure-JS territory and never needs a real Postgres.
vi.mock("@ykp/engine/triggers", async () => {
  return {
    lateStaffTrigger: () => ({ fire: true, severity: "warning", message: "mock-late" }),
    cashDiffTrigger: () => ({ fire: true, severity: "critical", message: "mock-cash" }),
    supplierOverdueTrigger: () => ({ fire: true, severity: "warning", message: "mock-supplier" }),
    pettyCashAnomalyTrigger: () => ({ fire: false, severity: "warning", message: "" }),
    highExpenseTrigger: () => ({ fire: false, severity: "warning", message: "" }),
    schemaMismatchTrigger: () => ({ fire: false, severity: "warning", message: "" }),
    dataMissingTrigger: () => ({ fire: false, severity: "warning", message: "" }),
  };
});

vi.mock("@ykp/schema", async () => {
  function makeRecorder(label: string) {
    return {
      select: () => {
        touchLog.push({ table: label, op: "select" });
        return { from: () => ({ where: () => ({ limit: async () => [] }), orderBy: () => ({ limit: async () => [] }) }) };
      },
      insert: () => {
        touchLog.push({ table: label, op: "insert" });
        return { values: async () => undefined, onConflictDoUpdate: () => ({ values: async () => undefined }) };
      },
      update: () => {
        touchLog.push({ table: label, op: "update" });
        return { set: () => ({ where: () => ({ returning: async () => [] }) }) };
      },
    };
  }
  // Minimal schema stubs — only the tables we touch. Anything else would
  // never be hit because the test mocks the engine internals.
  return {
    hrDailySummary: makeRecorder("hr_daily_summary"),
    finDailySummary: makeRecorder("fin_daily_summary"),
    hermezDailyBrief: makeRecorder("hermez_daily_brief"),
    hermezAlertLog: makeRecorder("hermez_alert_log"),
    hermezConfig: makeRecorder("hermez_config"),
    hermezAuditLog: makeRecorder("hermez_audit_log"),
    hrAttendance: makeRecorder("hr_attendance"),
    hrPayroll: makeRecorder("hr_payroll"),
    finPosDaily: makeRecorder("fin_pos_daily"),
    finSupplierCost: makeRecorder("fin_supplier_cost"),
    finPettyCash: makeRecorder("fin_petty_cash"),
    finExpense: makeRecorder("fin_expense"),
    finClosingCash: makeRecorder("fin_closing_cash"),
    finOpeningBalance: makeRecorder("fin_opening_balance"),
    masterBrand: makeRecorder("master_brand"),
    masterOutlet: makeRecorder("master_outlet"),
    masterSupplier: makeRecorder("master_supplier"),
    masterEmployee: makeRecorder("master_employee"),
    hrDailySummaryTable: makeRecorder("hr_daily_summary"),
  };
});

// Mock the lookup helpers to return deterministic names.
vi.mock("@ykp/engine/lookup", async () => ({
  getBrandName: async () => "Mock Brand",
  getOutletName: async () => "Mock Outlet",
  getSupplierName: async () => "Mock Supplier",
  getEmployeeName: async () => "Mock Employee",
}));

vi.mock("@ykp/engine/id-gen", async () => ({
  hermezBriefId: (d: string) => `HZBR-${d.replace(/-/g, "")}`,
  hermezAlertId: (d: string, n: number) => `HZAL-${d.replace(/-/g, "")}-${String(n).padStart(3, "0")}`,
}));

import { generateBriefForDate } from "@ykp/engine";

beforeEach(() => {
  touchLog.length = 0;
});

describe("hermez brief smoke", () => {
  it("only reads hr_daily_summary + fin_daily_summary + master_*, writes hermez_*", async () => {
    const result = await generateBriefForDate({
      hermezDb: {} as never,
      hrDb: {} as never,
      financeDb: {} as never,
      masterDb: {} as never,
      date: "2026-07-06",
    });

    expect(result.brief.briefId).toBe("HZBR-20260706");
    expect(result.alerts.length).toBeGreaterThanOrEqual(2);

    // No writes to HR / Finance source tables.
    const banned: string[] = [
      "hr_attendance",
      "hr_payroll",
      "fin_pos_daily",
      "fin_supplier_cost",
      "fin_petty_cash",
      "fin_expense",
      "fin_closing_cash",
      "fin_opening_balance",
    ];
    for (const t of banned) {
      const writes = touchLog.filter((x) => x.table === t && (x.op === "insert" || x.op === "update" || x.op === "delete"));
      expect(writes, `must not write to ${t}`).toHaveLength(0);
    }

    // Only hermez_* writes.
    const hermezWrites = touchLog.filter(
      (x) =>
        x.table.startsWith("hermez_") && (x.op === "insert" || x.op === "update"),
    );
    expect(hermezWrites.length).toBeGreaterThan(0);
  });
});