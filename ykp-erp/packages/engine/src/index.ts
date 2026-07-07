// ============================================================
// @ykp/engine — public entry point
// ------------------------------------------------------------
// Re-exports every engine module: payroll, attendance, summaries,
// moka importer, approval FSM, hermez brief + triggers, telegram,
// cron, audit, id-gen, lookup.
// ============================================================

export * from "./payroll.js";
export * from "./attendance.js";
export * from "./hr-summary.js";
export * from "./fin-summary.js";
export * from "./moka-importer.js";
export * from "./approval.js";
export * from "./hermez-brief.js"; // includes getHermezConfig + TriggerConfig
export * from "./triggers.js";
export * from "./lookup.js";
export * from "./telegram.js";
export * from "./cron.js";
export * from "./audit.js";
export * from "./id-gen.js";

export const ENGINE_VERSION = "0.1.0";

export type EngineHealth = {
  status: "ok" | "degraded";
  writebackEnabled: boolean;
  runHourUtc: number;
};

export function engineHealth(): EngineHealth {
  return {
    status: "ok",
    writebackEnabled: process.env.HERMEZ_WRITEBACK_ENABLED === "true",
    runHourUtc: Number(process.env.HERMEZ_RUN_HOUR_UTC ?? 15),
  };
}