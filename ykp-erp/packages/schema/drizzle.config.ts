import { defineConfig } from "drizzle-kit";

// ============================================================
// drizzle-kit configuration — YKP ERP schema package
// ------------------------------------------------------------
// Four separate Postgres logical databases. drizzle-kit can only
// emit one set of migrations per `defineConfig` call, so we expose
// four named configs via a record. Run each with the `--config`
// flag pointing at a small launcher file (see below) or use the
// `drizzle-kit generate --name=master` workflow:
//
//   drizzle-kit generate --config=drizzle.config.master.ts
//   drizzle-kit generate --config=drizzle.config.hr.ts
//   drizzle-kit generate --config=drizzle.config.finance.ts
//   drizzle-kit generate --config=drizzle.config.hermez.ts
//
// Migrations land under packages/schema/migrations/{master,hr,finance,hermez}/.
// ============================================================

export default defineConfig({
  schema: "./src/master.ts",
  out: "./migrations/master",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_MASTER_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_master",
  },
  // master owns the shared lookup tables; verbose helps audit the
  // generated SQL for FK + enum + constraint correctness.
  verbose: true,
  strict: true,
});