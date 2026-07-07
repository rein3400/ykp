import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the HR database.
 * Migrations land in packages/schema/migrations/hr/
 */
export default defineConfig({
  schema: "./src/hr.ts",
  out: "./migrations/hr",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_HR_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_hr",
  },
  verbose: true,
  strict: true,
});