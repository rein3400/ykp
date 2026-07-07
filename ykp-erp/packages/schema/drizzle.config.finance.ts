import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the FINANCE database.
 * Migrations land in packages/schema/migrations/finance/
 */
export default defineConfig({
  schema: "./src/finance.ts",
  out: "./migrations/finance",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_FINANCE_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_finance",
  },
  verbose: true,
  strict: true,
});