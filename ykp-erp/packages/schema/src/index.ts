// ============================================================
// @ykp/schema — public entry point
// ------------------------------------------------------------
// Re-exports every Drizzle schema + every DB client factory.
// Apps should `import { initDbClients, getMasterDb, ... }` from
// "@ykp/schema" to access cross-DB clients and table types.
// ============================================================

// ----- db clients (factories + boot helpers) -----
export * from "./db/clients.js";

// ----- master database -----
export * from "./master.js";

// ----- hr database -----
export * from "./hr.js";

// ----- finance database -----
export * from "./finance.js";

// ----- hermez database -----
export * from "./hermez.js";

// ----- raw migration runner (CLI entry) -----
// Importing this file does NOT run migrations; run `node migrate.ts`
// (or via package script) to apply them.
export { default as runMigrations } from "./migrate.js";