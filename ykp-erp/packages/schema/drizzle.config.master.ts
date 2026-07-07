import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the MASTER database.
 * Migrations land in packages/schema/migrations/master/
 */
export default defineConfig({
  schema: "./src/master.ts",
  out: "./migrations/master",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_MASTER_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_master",
  },
  verbose: true,
  strict: true,
});