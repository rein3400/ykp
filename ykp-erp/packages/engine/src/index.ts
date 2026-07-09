// ============================================================
// @ykp/engine — public entry point
// ------------------------------------------------------------
// Re-exports every engine module: payroll, attendance, summaries,
// moka importer, approval FSM, hermez brief + triggers, telegram,
// cron, audit, id-gen, lookup.
// ============================================================

export * from './payroll';
export * from './attendance';
export * from './hr-summary';
export * from './fin-summary';
export * from './moka-importer';
export * from './approval';
export * from './hermez-brief'; // includes getHermezConfig + TriggerConfig
export * from './triggers';
export * from './lookup';
// NOTE: cron/telegram are server-only (BullMQ + ioredis). Import from
// `@ykp/engine/cron` and `@ykp/engine/telegram` directly from worker code
// to avoid bundling them into client apps.
export { logAudit, nowWibIso, todayWib, type AuditDomain, type AuditEntry } from './audit';
export * from './id-gen';

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