// ============================================================
// @ykp/schema — public entry point.
// ============================================================

export * from "./db/clients";
export * from "./master";
export * from "./hr";
export * from "./finance";
export * from "./hermez";
// runMigrations intentionally not re-exported — migrate.ts runs `main()` at
// module load time, which crashes if YKP_DATABASE_URL is unset. CI/SSR safety.